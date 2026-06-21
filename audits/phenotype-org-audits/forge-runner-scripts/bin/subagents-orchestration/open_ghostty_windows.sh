#!/bin/zsh
# Forge Recovery - Auto-generated tmux sessions

SESSION1="forge_recover_1"
SESSION2="forge_recover_2"
SESSION3="forge_recover_3"

# Kill existing sessions
tmux kill-session -t $SESSION1 2>/dev/null
tmux kill-session -t $SESSION2 2>/dev/null
tmux kill-session -t $SESSION3 2>/dev/null

# Create sessions with 6 panes each (3x2 grid)
create_session() {
    local session=$1
    tmux new-session -d -x 300 -y 100 -s $session -n win1
    # Create 3x2 grid: 2 columns, then split each column into 3 rows
    tmux split-window -t $session:win1.0 -h -l 50%
    tmux split-window -t $session:win1.0 -v -l 33%
    tmux split-window -t $session:win1.1 -v -l 33%
    tmux split-window -t $session:win1.2 -v -l 50%
    tmux split-window -t $session:win1.3 -v -l 50%
    tmux select-layout -t $session:win1 tiled
}
create_session $SESSION1
create_session $SESSION2
create_session $SESSION3

# Send commands to each pane (NO C-m = user presses Enter manually)
cmd_1="forge --conversation-id a165d121-b032-4870-a124-26554340b985 -p \"Continue working on: Update \`src/lib.rs\` to re-export the new public API surface.. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.0 "$cmd_1"
tmux send-keys -t $SESSION1:win1.0 "echo 'Pane 1 ready'" C-m
cmd_2="forge --conversation-id 3042fe55-7fea-4388-963e-66236f3c28d6 -p \"Continue working on: (no title). Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.1 "$cmd_2"
tmux send-keys -t $SESSION1:win1.1 "echo 'Pane 2 ready'" C-m
cmd_3="forge --conversation-id a2826b54-9149-4d88-b780-0a779751b3d0 -p \"Continue working on: Add at least 3 unit tests per new port covering happy path + error variants.. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.2 "$cmd_3"
tmux send-keys -t $SESSION1:win1.2 "echo 'Pane 3 ready'" C-m
cmd_4="forge --conversation-id f329ef05-7996-4adb-88f2-061d9c675554 -p \"Continue working on: Multi-Agent Repo DAG Coordination. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.3 "$cmd_4"
tmux send-keys -t $SESSION1:win1.3 "echo 'Pane 4 ready'" C-m
cmd_5="forge --conversation-id e433e268-d54b-42c9-827e-21253bdfd862 -p \"Continue working on: Multi Agent Dag Repo Orchestration. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.4 "$cmd_5"
tmux send-keys -t $SESSION1:win1.4 "echo 'Pane 5 ready'" C-m
cmd_6="forge --conversation-id 4989d9d7-066a-489f-acf4-e4c6a5f3847b -p \"Continue working on: (no title). Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.5 "$cmd_6"
tmux send-keys -t $SESSION1:win1.5 "echo 'Pane 6 ready'" C-m
cmd_7="forge --conversation-id 6af5ef51-2114-4a84-b359-2ea5a40f1c75 -p \"Continue working on:   - Pine (Rust) — same approach. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.0 "$cmd_7"
tmux send-keys -t $SESSION2:win1.0 "echo 'Pane 7 ready'" C-m
cmd_8="forge --conversation-id c925da93-b763-4bc5-bde7-d5567e4fe697 -p \"Continue working on: Add concrete adapters in \`src/adapters/\` for both new ports:. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.1 "$cmd_8"
tmux send-keys -t $SESSION2:win1.1 "echo 'Pane 8 ready'" C-m
cmd_9="forge --conversation-id 2eee4552-2c35-476f-8ea5-38c3270aa2a6 -p \"Continue working on: Multi-Repo DAG Audit Orchestration. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.2 "$cmd_9"
tmux send-keys -t $SESSION2:win1.2 "echo 'Pane 9 ready'" C-m
cmd_10="forge --conversation-id 5a9c5deb-ebe4-4e3c-9cae-52e40bd42bbc -p \"Continue working on: Archived Repo DAG Planning Session. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.3 "$cmd_10"
tmux send-keys -t $SESSION2:win1.3 "echo 'Pane 10 ready'" C-m
cmd_11="forge --conversation-id b741d66b-ef54-4767-a3c8-51a503a6292f -p \"Continue working on: (no title). Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.4 "$cmd_11"
tmux send-keys -t $SESSION2:win1.4 "echo 'Pane 11 ready'" C-m
cmd_12="forge --conversation-id 1247ac19-5c19-4c30-8647-5d65d858533b -p \"Continue working on: Resume Creation Assistant. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.5 "$cmd_12"
tmux send-keys -t $SESSION2:win1.5 "echo 'Pane 12 ready'" C-m
cmd_13="forge --conversation-id c656ae52-62f6-4417-a9e0-bb8ff24ba4ba -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.0 "$cmd_13"
tmux send-keys -t $SESSION3:win1.0 "echo 'Pane 13 ready'" C-m
cmd_14="forge --conversation-id 8b1154b3-94bb-4d30-8603-e979d2a9ad65 -p \"Continue working on: Identify the next 2 ports/adapters to add. Consider:. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.1 "$cmd_14"
tmux send-keys -t $SESSION3:win1.1 "echo 'Pane 14 ready'" C-m
cmd_15="forge --conversation-id f437e44a-4250-406a-8733-c882ad43862c -p \"Continue working on: Multi-Agent DAG With Dedup Locking. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.2 "$cmd_15"
tmux send-keys -t $SESSION3:win1.2 "echo 'Pane 15 ready'" C-m
cmd_16="forge --conversation-id 6911e5e4-7c12-4470-9439-7c1c8e6430c8 -p \"Continue working on: Add 2 new hexagonal ports to \`kmobile-core/src/ports/\`:. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.3 "$cmd_16"
tmux send-keys -t $SESSION3:win1.3 "echo 'Pane 16 ready'" C-m
cmd_17="forge --conversation-id 5dc24a8f-a066-47e4-9b73-973c92a9b28f -p \"Continue working on:   - The data types involved. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.4 "$cmd_17"
tmux send-keys -t $SESSION3:win1.4 "echo 'Pane 17 ready'" C-m
cmd_18="forge --conversation-id c4847841-b95d-4caa-b8a5-1f52d6c6f9d7 -p \"Continue working on: Add 2 new hexagonal ports to the ports/ directory:. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.5 "$cmd_18"
tmux send-keys -t $SESSION3:win1.5 "echo 'Pane 18 ready'" C-m

# Open Ghostty windows
open -na Ghostty.app --args -e "tmux attach -t $SESSION1"
open -na Ghostty.app --args -e "tmux attach -t $SESSION2"
open -na Ghostty.app --args -e "tmux attach -t $SESSION3"

echo "3 Ghostty windows opened with tmux sessions."
echo "Session 1: $SESSION1 (6 panes)"
echo "Session 2: $SESSION2 (6 panes)"
echo "Session 3: $SESSION3 (6 panes)"
echo ""
echo "Commands have been typed in each pane. Press Enter in each pane to run."
