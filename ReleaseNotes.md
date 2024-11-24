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
