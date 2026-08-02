from __future__ import annotations

import sys

from . import precommit_state, review_config


def main() -> int:
    # pre-commit レビューが無効なら streak リセットも不要。
    if not review_config.load_config().get("precommit_review_enabled", True):
        return 0

    branch = precommit_state.current_branch()
    if not branch or branch == "HEAD" or not precommit_state.is_valid_branch(branch):
        return 0

    state_path = precommit_state.state_file_path()
    state = precommit_state.read_state(state_path)
    precommit_state.reset_all_streaks(state, branch)
    precommit_state.write_state(state_path, state)
    print(
        f"[post-commit-reset] reset LOW-only streak for branch '{branch}'.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
