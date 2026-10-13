# Surface evidence

Read only the section matching the deliverable. Choose concrete inputs/actions and
an observable expected result for each relevant scenario; counts and separate log
files are not goals. Exercise the real boundary, not a printed command or dry-run
that avoids the behavior being claimed. Reuse valid captured results.

## HTTP, CLI and data

For an API, call the running endpoint with a concrete request (for example curl
or an API request context) and inspect the relevant status, headers, body and
side effects. CLI stdout/stderr, exit status, parsed configuration and database
state changes are first-class evidence for those outcomes. Include realistic
failure paths when they threaten the requested behavior; do not force browser
QA onto a nonvisual CLI/data deliverable.

## Browser and desktop GUI

Use an exposed browser capability or the project's configured browser; confirm
the required connection/session and drive the actual page. Use an available
browser-session guide when provider selection is unclear. For non-browser GUI
criteria, drive the running application through OS-level automation rather than
substituting a CLI dump. Inspect screenshots for visual criteria: DOM/text output
cannot establish rendered quality. Apply the selected Visual QA skill and its
required independent passes where applicable; this reference does not relax them.

Preserve borrowed login state. Never clear user cookies/cache/site data or close
the user's browser for cleanup. Use an owned disposable context/profile for
destructive session checks. Missing surface capability leaves the criterion
unverified; installing tools requires applicable authorization.

## Terminal UI

Drive a live PTY for interaction. For visual criteria capture the target terminal
or a faithful renderer such as xterm.js, preserving color and wide-glyph widths.
A tmux text capture is not color/layout/CJK proof. If the project supplies a
terminal capture helper, use its supported inputs; otherwise use an available
faithful renderer. Inspect captured pixels and apply selected Visual QA gates.
Do not waive visual criteria because a renderer is unavailable.

## Resource ownership

Close only the processes, sessions, contexts and temporary resources created for
the check, preserving user-owned state and deliverables. Verify meaningful teardown
(such as a released server port) and report leftovers. No separate cleanup receipt
is required unless the execution owner's selected contract requires one.
