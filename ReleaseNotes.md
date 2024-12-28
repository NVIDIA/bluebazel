# Blue Bazel - Changelog

## 0.0.1

First release of Blue Bazel VS Code extension, which provides UI integration for bazel/dazel project building, running, debugging, and testing.

## 0.0.2

Fix issue with executable paths not working because run configs were not applied to the query that retrieves the target path.

## 0.0.3

Stop showing output pane for background tasks. Include file based settings for projects. Show progress bar for long-running tasks.

## 0.0.4

Fix bug that caused empty test_arg to appear when there were no test args. Add ability to set environment before bazel commands.

## 0.0.5

Fix bug that caused user to reload if settings changed for settings that did not require that.
Fix issue of running query every time test button is pushed.
Added copy buttons to args and to commands.

## 1.0.0

First major release.
Refactor entire codebase to address separation of concerns throughtout.
Add capability to add multiple types of actions (not just build, run, test) such as query.
Add capability to add multiple targets to each action.
Add capability to debug golang and python targets.
Add autocomplete (if available) to config and bazel args for target properties.
Add quickpick for all targets.

## 1.0.1

Add code lens actions to some language unit tests (run test and debug test).
Fix bug that caused multiple refresh targets to fire when multiple BUILD files were changed at once (usually a git operation).
Add option to not refresh targets automatically when BUILD files change as it is still experimental.
Add optional timeout in milliseconds to refresh targets.

## 1.0.2

Change loading of available targets so if cache exists, do no load targets.
Make refreshing targets on workspace open optional.
Fix regex for c/c++ test code lens provider.
Add plugin support for languages.
Add debug direct support for python.
Python debugging with bazel run_under does not work because debugpy cannot work with os.execv. This is called when py_binary builds a wrapper around the src files in the py_binary.
Allow for no reload when custom buttons are created.

## 1.0.3

Change the way available targets are fetched. Now they can be fetched from BUILD files so that the Bazel engine is not tied up using query. The old query is maintained via a setting.
Add a dialog before running clean command.
Add capability to run and debug from main functions for languages that have support.

## 1.0.4

Swap typescript in for awk when available targets are fetched. Awk, albeit much faster, is not as portable as the typescript solution.
Remove shellscript from C++ language support.
Clear the workspace state only on major version changes.

## 1.0.5

Fix bug where no output from quickpik is returned.
