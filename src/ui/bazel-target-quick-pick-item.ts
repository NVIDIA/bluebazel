import * as vscode from 'vscode';
import { BazelTarget } from '../models/bazel-target';

export interface BazelTargetQuickPickItem extends vscode.QuickPickItem {
    target: BazelTarget;
}