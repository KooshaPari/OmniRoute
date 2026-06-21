#!/bin/zsh
# Forge Recovery - Top 18 subagent chats

SESSION1="forge_subagents_1"
SESSION2="forge_subagents_2"
SESSION3="forge_subagents_3"

# Kill existing sessions
tmux kill-session -t $SESSION1 2>/dev/null
tmux kill-session -t $SESSION2 2>/dev/null
tmux kill-session -t $SESSION3 2>/dev/null

# Create sessions with 6 panes each
create_session() {
    local session=$1
    tmux new-session -d -x 300 -y 100 -s $session -n win1
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
cmd_1="forge --conversation-id 77a4cf2a-50e9-47fc-92c1-9c85c09be0cc -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.0 "$cmd_1"
tmux send-keys -t $SESSION1:win1.0 "echo 'Pane 1 ready'" C-m
cmd_2="forge --conversation-id 9cb6fa7f-cb7e-4f9d-add8-3422c8603214 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.1 "$cmd_2"
tmux send-keys -t $SESSION1:win1.1 "echo 'Pane 2 ready'" C-m
cmd_3="forge --conversation-id f8eba8a4-d314-45f7-a5e2-8bcb7de8b9bd -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.2 "$cmd_3"
tmux send-keys -t $SESSION1:win1.2 "echo 'Pane 3 ready'" C-m
cmd_4="forge --conversation-id a4de47a0-75c5-4a65-aff9-27d083fd9374 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.3 "$cmd_4"
tmux send-keys -t $SESSION1:win1.3 "echo 'Pane 4 ready'" C-m
cmd_5="forge --conversation-id 211e070f-56f9-4276-87b3-ab0f296c45ba -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.4 "$cmd_5"
tmux send-keys -t $SESSION1:win1.4 "echo 'Pane 5 ready'" C-m
cmd_6="forge --conversation-id 3c5b31fa-61ff-4dd4-a20c-a84c2ae4353f -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION1:win1.5 "$cmd_6"
tmux send-keys -t $SESSION1:win1.5 "echo 'Pane 6 ready'" C-m
cmd_7="forge --conversation-id bc121598-0d1b-4f65-beed-6fc7e753298d -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.0 "$cmd_7"
tmux send-keys -t $SESSION2:win1.0 "echo 'Pane 7 ready'" C-m
cmd_8="forge --conversation-id 8f4d6891-2b6c-47d0-ab2d-92b5c2a1e998 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.1 "$cmd_8"
tmux send-keys -t $SESSION2:win1.1 "echo 'Pane 8 ready'" C-m
cmd_9="forge --conversation-id 42ae8f05-efee-4ae7-bae7-95177bfc2ad1 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.2 "$cmd_9"
tmux send-keys -t $SESSION2:win1.2 "echo 'Pane 9 ready'" C-m
cmd_10="forge --conversation-id 6f1975e9-10c7-4a95-ad24-6dc668a092b4 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.3 "$cmd_10"
tmux send-keys -t $SESSION2:win1.3 "echo 'Pane 10 ready'" C-m
cmd_11="forge --conversation-id 4a44b2e1-07d2-48d7-bc7a-a7cba56befe5 -p \"Continue working on: Claude Worktree Consolidation and Cleanup Strategy. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.4 "$cmd_11"
tmux send-keys -t $SESSION2:win1.4 "echo 'Pane 11 ready'" C-m
cmd_12="forge --conversation-id 579eeb75-4e3e-4491-a393-d88e72db6eaa -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION2:win1.5 "$cmd_12"
tmux send-keys -t $SESSION2:win1.5 "echo 'Pane 12 ready'" C-m
cmd_13="forge --conversation-id 4207af24-f0f7-4849-91f9-5e924680845a -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.0 "$cmd_13"
tmux send-keys -t $SESSION3:win1.0 "echo 'Pane 13 ready'" C-m
cmd_14="forge --conversation-id 93c4c395-7d59-4afc-873e-403d3d5ea6ba -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.1 "$cmd_14"
tmux send-keys -t $SESSION3:win1.1 "echo 'Pane 14 ready'" C-m
cmd_15="forge --conversation-id 8dcda903-3c77-4b0c-a4ca-561cfca1c937 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.2 "$cmd_15"
tmux send-keys -t $SESSION3:win1.2 "echo 'Pane 15 ready'" C-m
cmd_16="forge --conversation-id a9f1fe1f-048e-49a1-9f9c-d325a7582923 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.3 "$cmd_16"
tmux send-keys -t $SESSION3:win1.3 "echo 'Pane 16 ready'" C-m
cmd_17="forge --conversation-id fe68a9d4-4dec-476b-9ede-0a05e03bb530 -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.4 "$cmd_17"
tmux send-keys -t $SESSION3:win1.4 "echo 'Pane 17 ready'" C-m
cmd_18="forge --conversation-id 7291f488-72a4-4286-8d3e-f21bd65dbd7b -p \"Continue from where you left off. Complete the task autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION3:win1.5 "$cmd_18"
tmux send-keys -t $SESSION3:win1.5 "echo 'Pane 18 ready'" C-m

# Open Ghostty windows
open -na Ghostty.app --args -e "tmux attach -t $SESSION1"
open -na Ghostty.app --args -e "tmux attach -t $SESSION2"
open -na Ghostty.app --args -e "tmux attach -t $SESSION3"

echo "3 Ghostty windows opened with tmux sessions for subagents."
echo "Session 1: $SESSION1 (6 panes)"
echo "Session 2: $SESSION2 (6 panes)"
echo "Session 3: $SESSION3 (6 panes)"
echo ""
echo "Commands have been typed in each pane. Press Enter in each pane to run."
