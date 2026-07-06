# ArgisMonitor Homebrew formula (Gate 4, file-only).
#
# This file lives at:  homebrew-tap/Formula/argismonitor.rb
# in the `KooshaPari/homebrew-tap` repository.
#
# Apply with:
#   cp argismonitor.rb ../../homebrew-tap/Formula/argismonitor.rb
#   cd ../../homebrew-tap
#   git commit -am "feat(argismonitor): add formula @ 3.8.44"
#   git push
#
# Then a user installs with:
#   brew tap KooshaPari/tap
#   brew install argismonitor

class Argismonitor < Formula
  desc "ArgisMonitor (formerly OmniRoute) — Unified AI router with 160+ providers"
  homepage "https://argismonitor.phenotype.space"
  url "https://registry.npmjs.org/argismonitor/-/argismonitor-#{version}.tgz"
  sha256 "<computed at release time>"
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *Language::Node.std_npm_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "argismonitor", shell_output("#{bin}/argismonitor --version")
  end
end