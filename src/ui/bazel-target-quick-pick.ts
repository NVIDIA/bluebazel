import { BazelTargetQuickPickItem } from './bazel-target-quick-pick-item';
import { BazelAction, BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { IconService } from '../services/icon-service';
import * as vscode from 'vscode';

// BazelTargetQuickPick class provides a UI component for selecting Bazel targets.
export class BazelTargetQuickPick {
    // VS Code QuickPick UI component for displaying and selecting Bazel targets.
    private quickPick: vscode.QuickPick<BazelTargetQuickPickItem>;

    // Callback function to handle the selected target or action.
    private resolve: ((value: BazelTarget | string | undefined) => void) | undefined;

    // Currently selected Bazel action (e.g., build, run).
    private currentAction: BazelAction | undefined;

    // List of available actions for the QuickPick.
    private actionItems: vscode.QuickPickItem[];

    // Manages cancellation of the current QuickPick process.
    private cancellationTokenSource: vscode.CancellationTokenSource;

    // If only one action is provided, set it as the default action.
    private defaultAction: BazelAction | undefined;

    constructor(
        private readonly actions: string[], // List of possible actions.
        private readonly iconService: IconService,
        private readonly bazelTargetManager: BazelTargetManager // Manages Bazel target information.
    ) {
        // If there is exactly one action, set it as the default action.
        if (this.actions.length === 1) {
            this.defaultAction = this.actions[0];
        }
        // Map each action to a QuickPick item.
        this.actionItems = this.actions.map(action => ({
            label: action,
        }));

        // Initialize a new VS Code QuickPick instance.
        this.quickPick = vscode.window.createQuickPick<BazelTargetQuickPickItem>();
        this.cancellationTokenSource = new vscode.CancellationTokenSource();
    }

    // Show a list of available actions in the QuickPick UI.
    private showActions() {
        this.quickPick.placeholder = 'Select a Bazel action or type a custom action...';
        this.quickPick.items = this.actionItems;
        this.currentAction = undefined;
        this.quickPick.show();
    }

    // Show the QuickPick UI and return a promise with the selected action or target.
    public show(): Promise<BazelTarget | string | undefined> {
        // If a default action is defined, directly show the matching targets.
        if (this.defaultAction) {
            this.currentAction = this.defaultAction;
            this.showMatchingTargets(''); // Display targets for the default action.
        } else {
            this.showActions(); // Otherwise, show available actions.
        }

        return new Promise(resolve => {
            this.resolve = resolve;

            // Register event listeners for various QuickPick interactions.
            this.quickPick.onDidChangeValue(value => this.onDidChangeValue(value));
            this.quickPick.onDidChangeSelection(selection => this.onDidChangeSelection(selection));
            this.quickPick.onDidAccept(() => this.onDidAccept());
            this.quickPick.onDidHide(() => this.onDidHide());
        });
    }

    // Handle changes in the input value of the QuickPick.
    private onDidChangeValue(value: string) {
        if (this.defaultAction) {
            // If there is a default action, filter targets by input text.
            this.showMatchingTargets(value);
            return;
        }

        const isAction = this.actions.some(action => action.includes(value.trim()));

        if (value && !isAction && this.currentAction) {
            // Custom input, show filtered Bazel targets.
            this.showMatchingTargets(value);
        } else if (this.actions.some(action => action === value.trim())) {
            // Exact match with one of the actions, show its targets.
            this.currentAction = value.trim();
            this.showMatchingTargets(value);
        } else if (isAction) {
            // Partial action input, show available actions.
            this.showActions();
        }
    }

    // Handle changes in the selected item in the QuickPick.
    private onDidChangeSelection(selection: readonly BazelTargetQuickPickItem[]) {
        const selectedAction = selection[0].label;

        // If the selection is a valid action, set it as the current action and show targets.
        if (this.actions.includes(selectedAction)) {
            this.currentAction = selectedAction;
            this.showMatchingTargets(selectedAction);
        }
    }

    // Show matching Bazel targets based on the current input.
    private async showMatchingTargets(value: string) {
        // Determine the filter text to match targets.
        const filterText = this.defaultAction ? value : value.split(' ').slice(1).join(' ');
        this.quickPick.busy = true; // Indicate that the QuickPick is busy.
        this.quickPick.show();
        this.quickPick.matchOnDetail = true;

        // Define a prefix for targets based on the current action.
        const actionPrefix = this.defaultAction || this.currentAction || '';

        // Fetch the list of available Bazel targets for the given action.
        const targets = this.bazelTargetManager.getAvailableTargets(actionPrefix);

        // Construct QuickPick items for the matching targets.
        const prependItemText = this.defaultAction ? '' : `${actionPrefix} `;

        const filteredTargets = targets
            .filter(target => target.label.includes(filterText) || target.bazelPath.includes(filterText))
            .slice(0, 50);

        console.log(filterText, filteredTargets);

        const targetItems = filteredTargets
            .map(target => ({
                label: `${prependItemText}${target.label}`,
                detail: `${prependItemText}${target.bazelPath}`,
                iconPath: this.iconService.getIcon(target.language),
                target: target,
            } as BazelTargetQuickPickItem));

        // If matching targets are found, display them in the QuickPick.
        if (targetItems.length > 0) {
            this.quickPick.items = targetItems;
            this.quickPick.placeholder = 'Select a Bazel target...';
        } else {
            // Display a message if no targets are found.
            this.quickPick.items = [{ label: 'No matching targets found.' }];
        }

        this.quickPick.busy = false; // Mark the QuickPick as not busy.
    }

    // Handle the acceptance of the selected item in the QuickPick.
    private onDidAccept() {
        const selection = this.quickPick.selectedItems[0];
        if ((this.currentAction || this.defaultAction) && selection && selection.target) {
            // If a valid action and target are selected, resolve with the target.
            if (this.resolve) {
                this.resolve(selection.target);
            }
            this.quickPick.hide();
        } else if (selection) {
            // Otherwise, update the input value with the selection.
            this.quickPick.value = `${selection.label} `;
        } else if (!selection) {
            // If no selection, resolve with the input value.
            if (this.resolve) {
                this.resolve(this.quickPick.value);
            }
            this.quickPick.hide();
        }
    }

    // Handle the hiding of the QuickPick UI.
    private onDidHide() {
        // Resolve the promise as undefined if the QuickPick is hidden.
        if (this.resolve) {
            this.resolve(undefined);
        }

        // Cancel the current operation if applicable.
        if (this.cancellationTokenSource) {
            this.cancellationTokenSource.cancel();
        }
    }
}
