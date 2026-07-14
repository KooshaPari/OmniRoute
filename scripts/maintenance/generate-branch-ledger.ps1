param(
  [string]$Repository = "KooshaPari/OmniRoute",
  [string]$BaseBranch = "main",
  [string]$OutputDirectory = "docs/recovery"
)

$ErrorActionPreference = "Stop"
$snapshotAt = (Get-Date).ToUniversalTime().ToString("o")
$baseRef = "origin/$BaseBranch"
$baseSha = (git rev-parse $baseRef).Trim()
$repoUrl = "https://github.com/$Repository"

function Invoke-Git([string[]]$Arguments, [switch]$AllowFailure) {
  $output = & git @Arguments 2>$null
  if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
    throw "git $($Arguments -join ' ') failed"
  }
  return @($output)
}

function Get-Subsystem([string[]]$Paths) {
  $tags = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($path in $Paths) {
    $tag = switch -Regex ($path) {
      '^\.github/' { 'ci'; break }
      '^(docs/|README|ADR|PLAN|SPEC|STATUS|CONTRIBUTING)' { 'docs'; break }
      '^(package[^/]*\.json|bun\.lock|.*lock\.ya?ml|tsconfig|eslint|prettier|oxlint)' { 'tooling'; break }
      '^apps/web/' { 'web-v4'; break }
      '^apps/bff/' { 'bff-v4'; break }
      '^apps/desktop/' { 'desktop-v4'; break }
      '^src/' { 'core'; break }
      '^open-sse/' { 'routing'; break }
      '^tests/' { 'tests'; break }
      '^db/' { 'database'; break }
      '^vendor/' { 'vendor'; break }
      default { 'other' }
    }
    [void]$tags.Add($tag)
  }
  if ($tags.Count -eq 0) { return 'none' }
  return (($tags | Sort-Object) -join ';')
}

function Get-NameFamily([string]$Name) {
  $family = $Name.ToLowerInvariant()
  $family = $family -replace '^(origin/)', ''
  $family = $family -replace '^(upstream-pr/|rebase/|rebase-|land/|land-|ship/)', ''
  $family = $family -replace '^(koosha/|codex/|agent/)', ''
  $family = $family -replace '(^|/)(v\d+|clean|finish|fresh|refresh|recut|replay|rescue)(-|/|$)', '$1'
  $family = $family -replace '-20\d{2}-\d{2}-\d{2}$', ''
  $family = $family -replace '-v?\d+$', ''
  return (($family -replace '[^a-z0-9]+', '-').Trim('-'))
}

function Get-Recommendation($Row) {
  if ($Row.branch -eq $BaseBranch) { return @('base', 'retain') }
  if ($Row.contained -eq $true -or $Row.patch_equivalent_to_main -eq $true) {
    return @('superseded', 'archive-after-owner-review')
  }
  if ($Row.branch -match '^(release/|v\d|wip/|merge/|phase-0/)' ) {
    return @('archive', 'retain-as-read-only-donor')
  }
  if ($Row.branch -match '^(agent/|koosha/|fix/|feat/|security/|chore/|docs/|codex/|qol/)' -and $Row.ahead -gt 0 -and $Row.ahead -le 50 -and $Row.behind -le 500) {
    return @('salvage', 'review-and-cherry-pick-to-fresh-main-branch')
  }
  if ($Row.ahead -gt 0) { return @('salvage', 'diff-first;do-not-merge-wholesale') }
  return @('superseded', 'archive-after-owner-review')
}

$branches = gh api --paginate "repos/$Repository/branches?per_page=100" | ConvertFrom-Json
$rows = [System.Collections.Generic.List[object]]::new()

foreach ($branch in $branches) {
  $name = [string]$branch.name
  $sha = [string]$branch.commit.sha
  & git show-ref --verify --quiet "refs/remotes/origin/$name"
  if ($LASTEXITCODE -ne 0) {
    & git fetch origin "+refs/heads/$name`:refs/remotes/origin/$name" --quiet
  }
}

$refMetadata = @{}
$format = "%(refname:strip=3)%09%(objectname)%09%(committerdate:iso-strict)%09%(authorname)%09%(subject)%09%(ahead-behind:$baseSha)"
$metadataLines = Invoke-Git @('for-each-ref', 'refs/remotes/origin', "--format=$format")
foreach ($line in $metadataLines) {
  $parts = $line -split "`t", 6
  if ($parts.Count -ge 6) {
    $counts = $parts[5] -split '\s+'
    $refMetadata[$parts[0]] = [pscustomobject]@{
      sha = $parts[1]
      activity = $parts[2]
      author = $parts[3]
      subject = $parts[4]
      ahead = [int]$counts[0]
      behind = [int]$counts[1]
    }
  }
}

foreach ($branch in $branches) {
  $name = [string]$branch.name
  $sha = [string]$branch.commit.sha
  $meta = $refMetadata[$name]
  if ($null -eq $meta) { throw "Missing metadata for $name" }
  $behind = $meta.behind
  $ahead = $meta.ahead
  $contained = $ahead -eq 0
  $paths = @()
  if ($ahead -gt 0 -and $ahead -le 250) {
    $paths = Invoke-Git @('diff', '--name-only', "$baseSha...$sha") -AllowFailure
  }
  $patchEquivalent = $false
  $patchCheck = 'not-run'
  if (-not $contained -and $ahead -gt 0 -and $ahead -le 10 -and $behind -le 500) {
    $cherry = Invoke-Git @('cherry', $baseSha, $sha) -AllowFailure
    $patchEquivalent = $cherry.Count -gt 0 -and @($cherry | Where-Object { $_ -like '+*' }).Count -eq 0
    $patchCheck = if ($patchEquivalent) { 'all-patches-contained' } else { 'unique-patches-present' }
  } elseif ($contained) {
    $patchCheck = 'tip-contained'
  }

  $row = [ordered]@{
    branch = $name
    url = "$repoUrl/tree/$([uri]::EscapeDataString($name))"
    sha = $sha
    ahead = $ahead
    behind = $behind
    contained = $contained
    patch_equivalent_to_main = $patchEquivalent
    patch_check = $patchCheck
    last_activity = $meta.activity
    author = $meta.author
    subject = $meta.subject
    changed_file_count = $paths.Count
    subsystems = Get-Subsystem $paths
    name_family = Get-NameFamily $name
    classification = ''
    recommended_action = ''
    confidence = if ($contained -or $patchCheck -ne 'not-run') { 'high' } elseif ($ahead -le 250) { 'medium' } else { 'low' }
    uncertainty = if ($ahead -gt 250) { 'path and patch analysis skipped due branch size' } elseif ($patchCheck -eq 'not-run') { 'patch identity not evaluated' } else { '' }
  }
  $decision = Get-Recommendation $row
  $row.classification = $decision[0]
  $row.recommended_action = $decision[1]
  $rows.Add([pscustomobject]$row)
}

$tipGroups = $rows | Group-Object sha | Where-Object Count -gt 1
foreach ($group in $tipGroups) {
  foreach ($row in $group.Group) {
    if ($row.branch -ne $BaseBranch) {
      $row.classification = 'duplicate'
      $row.recommended_action = 'retain-one-tip;archive-duplicates-after-review'
      $row.uncertainty = "identical tip shared by: $($group.Group.branch -join ', ')"
      $row.confidence = 'high'
    }
  }
}

$familyGroups = $rows | Group-Object name_family | Where-Object Count -gt 1
$salvage = $rows |
  Where-Object classification -eq 'salvage' |
  Sort-Object @{ Expression = 'behind'; Ascending = $true }, @{ Expression = 'ahead'; Ascending = $true }, @{ Expression = 'last_activity'; Descending = $true } |
  Select-Object -First 20

New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$jsonPath = Join-Path $OutputDirectory 'branch-integration-ledger.json'
$csvPath = Join-Path $OutputDirectory 'branch-integration-ledger.csv'
$mdPath = Join-Path $OutputDirectory 'BRANCH-INTEGRATION-LEDGER.md'

$document = [ordered]@{
  schema_version = 1
  repository = $Repository
  snapshot_at = $snapshotAt
  base_branch = $BaseBranch
  base_sha = $baseSha
  branch_count = $rows.Count
  methodology = @('batched git ahead/behind graph analysis', 'ahead=0 containment', 'git cherry for branches <=10 commits ahead and <=500 behind', 'path subsystem scan for branches <=250 commits ahead', 'identical-tip and normalized-name clustering')
  branches = $rows
}
$document | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $jsonPath
$rows | Export-Csv -NoTypeInformation -Encoding utf8 $csvPath

$summary = $rows | Group-Object classification | Sort-Object Name
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('# Branch integration ledger')
$lines.Add('')
$lines.Add("Snapshot: `$snapshotAt` · Base: [`$BaseBranch`]($repoUrl/tree/$BaseBranch) at ``$baseSha`` · Branches: **$($rows.Count)**")
$lines.Add('')
$lines.Add('This is a triage ledger, not merge authorization. Large branches intentionally receive lower-confidence analysis; they must be diffed and tested on a fresh branch from `main`.')
$lines.Add('')
$lines.Add('## Classification summary')
$lines.Add('')
$lines.Add('| Classification | Count |')
$lines.Add('|---|---:|')
foreach ($item in $summary) { $lines.Add("| $($item.Name) | $($item.Count) |") }
$lines.Add('')
$lines.Add('## First salvage batch')
$lines.Add('')
$lines.Add('| Priority | Branch | Ahead / behind | Subsystems | Recommendation | Confidence |')
$lines.Add('|---:|---|---:|---|---|---|')
$priority = 1
foreach ($row in $salvage) {
  $lines.Add("| $priority | [`$($row.branch)`]($($row.url)) | $($row.ahead) / $($row.behind) | $($row.subsystems) | $($row.recommended_action) | $($row.confidence) |")
  $priority++
}
$lines.Add('')
$lines.Add('## Duplicate families')
$lines.Add('')
foreach ($group in ($familyGroups | Sort-Object Count -Descending | Select-Object -First 40)) {
  $lines.Add("- **$($group.Name)**: $($group.Group.branch -join ', ')")
}
$lines.Add('')
$lines.Add('## Complete branch inventory')
$lines.Add('')
$lines.Add('| Branch | Ahead | Behind | Contained | Last activity | Subsystems | Class | Action | Confidence / uncertainty |')
$lines.Add('|---|---:|---:|:---:|---|---|---|---|---|')
foreach ($row in ($rows | Sort-Object branch)) {
  $certainty = if ($row.uncertainty) { "$($row.confidence): $($row.uncertainty)" } else { $row.confidence }
  $lines.Add("| [`$($row.branch)`]($($row.url)) | $($row.ahead) | $($row.behind) | $($row.contained) | $($row.last_activity) | $($row.subsystems) | $($row.classification) | $($row.recommended_action) | $certainty |")
}
$lines.Add('')
$lines.Add('## Method and uncertainty')
$lines.Add('')
$lines.Add('- Ahead/behind and containment are exact for this snapshot.')
$lines.Add('- Patch equivalence uses `git cherry` only for branches with at most 10 commits ahead and at most 500 behind; larger histories are explicitly marked unevaluated.')
$lines.Add('- Touched subsystems use merge-base diffs only through 250 commits ahead to avoid misrepresenting giant release lineages.')
$lines.Add('- Name-family clusters are candidates, not proof of equivalence. Identical tip SHA is proof that branch tips match.')
$lines.Add('- Recommended salvage means cherry-pick or reconstruct verified commits onto a new `main` branch; never merge donor history wholesale.')
$lines | Set-Content -Encoding utf8 $mdPath

Write-Output "Generated $($rows.Count) branches at $snapshotAt"
