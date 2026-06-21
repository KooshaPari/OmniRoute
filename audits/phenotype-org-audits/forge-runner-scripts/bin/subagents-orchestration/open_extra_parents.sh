#!/bin/zsh
# Forge Recovery - Additional parent chats

SESSION="forge_recover_extra"

# Kill existing session
tmux kill-session -t $SESSION 2>/dev/null

# Create session with 3 panes
tmux new-session -d -x 300 -y 100 -s $SESSION -n win1
tmux split-window -t $SESSION:win1 -h -l 33%
tmux split-window -t $SESSION:win1.0 -h -l 50%
tmux select-layout -t $SESSION:win1 even-horizontal

# Send commands to each pane (NO C-m = user presses Enter manually)
cmd_1="forge --conversation-id 56eda7e6-3482-4974-82b6-86bb82d59c54 -p \"Continue working on: Multi Repo Audit And Dag Orchestration. Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION:win1.0 "$cmd_1"
tmux send-keys -t $SESSION:win1.0 "echo 'Pane 1 ready'" C-m
cmd_2="forge --conversation-id ef2c5ccd-0d44-44f5-820e-fa5a9b13efd1 -p \"Continue working on: (no title). Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION:win1.1 "$cmd_2"
tmux send-keys -t $SESSION:win1.1 "echo 'Pane 2 ready'" C-m
cmd_3="forge --conversation-id 4a2d19e1-0b24-4bc1-9d05-f7a73c8abfc0 -p \"Continue working on:   - **KEEP** (initialize properly with full governance and push to GitHub). Complete autonomously without asking for user confirmation.\" -C /Users/kooshapari/CodeProjects/Phenotype/repos"
tmux send-keys -t $SESSION:win1.2 "$cmd_3"
tmux send-keys -t $SESSION:win1.2 "echo 'Pane 3 ready'" C-m

# Open Ghostty window
open -na Ghostty.app --args -e "tmux attach -t $SESSION"

echo "1 Ghostty window opened with tmux session."
echo "Session: $SESSION (3 panes)"
echo ""
echo "Commands have been typed in each pane. Press Enter in each pane to run."
