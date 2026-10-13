# Local Commits — Authority, Preparation and Messages

Commit only when the current request, or an earlier user authorization that still applies, includes it. Finishing the work, passing checks or completing a workflow does not grant it, and under a no-commit or preview-only request nothing is staged either. Push, pull requests, merges and history rewriting each need their own authorization; commit authority covers none of them.

A worker commits only when its assignment says so, within the user's authorization. The lead looks at a worker's changes before integrating them, whether or not the worker committed them.

## Preparing a commit

Read the diff and the staged contents, and group them into commits that each hold one coherent change, with the source, tests and documents that belong to it. The user's and other agents' unrelated changes, staged or not, stay out of the commit and in place.

Committing is not a review. Work that was checked when it was done needs no new test run or reviewer to be committed. Run a check only for a part of the diff nobody has verified or whose diff shows a risk, and bring in a reviewer only when the user asks for one. When something in the diff is known to be broken or unfinished, say so, and commit it only as a checkpoint the user agreed to, naming what is missing.

After committing, report the commit identifiers Git printed.

## Commit messages

Write for a maintainer who has the repository but not the conversation. One commit
holds one change; split unrelated changes instead of listing them under one subject.
The subject names the change in the repository's convention. When the subject alone
does not explain it, add a body: why the change was needed, then what changed, one
short line per change stating the new behavior or rule, grouped by area when there
are several. Close with the checks you ran when they bear on trusting the change.
Write from the final diff; a simple change needs only its subject.
