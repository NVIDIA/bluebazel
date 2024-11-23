////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2024 NVIDIA Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
////////////////////////////////////////////////////////////////////////////////////

import * as vscode from 'vscode';

function createSpinnerUpdater(updateCallback: (spinner: string) => void) {
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;
    let interval: NodeJS.Timeout;

    const start = () => {
        interval = setInterval(() => {
            const spinner = spinnerFrames[spinnerIndex];
            updateCallback(spinner);
            spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        }, 100);
    };

    const stop = () => {
        if (interval) clearInterval(interval);
    };

    return { start, stop };
}


async function showProgressWindow<T>(
    title: string,
    longMethodPromise: Promise<T>,
    cancellationSource: vscode.CancellationTokenSource
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: title,
                cancellable: true,
            },
            async (progress, cancellationToken) => {
                const disposable = cancellationToken.onCancellationRequested(() => {
                    disposable.dispose();
                    cancellationSource.cancel();
                });

                const spinnerUpdater = createSpinnerUpdater((spinner) => {
                    progress.report({ increment: undefined, message: `${spinner}` });
                });

                try {
                    // Start spinner animation
                    spinnerUpdater.start();

                    // Await the long-running method
                    const result = await longMethodPromise;

                    // Stop spinner and report success
                    spinnerUpdater.stop();
                    progress.report({ increment: undefined, message: 'Finished' });
                    resolve(result);
                } catch (error) {
                    progress.report({ increment: undefined, message: 'Cancelled' });
                    reject(error);
                } finally {
                    spinnerUpdater.stop();
                }
            }
        );
    });
}

export async function showProgressStatus<T>(
    title: string,
    longMethodPromise: Promise<T>,
    cancellationSource: vscode.CancellationTokenSource
): Promise<T> {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

    const spinnerUpdater = createSpinnerUpdater((spinner) => {
        statusBarItem.text = `${spinner} ${title} $(x)`;
    });

    try {
        statusBarItem.tooltip = 'Click to cancel';
        statusBarItem.command = {
            command: `${title}.cancel`, // Custom command for cancellation
            title: 'Cancel',
        };
        statusBarItem.show();

        // Register the cancel command
        const disposable = vscode.commands.registerCommand(
            statusBarItem.command.command,
            () => {
                disposable.dispose();
                cancellationSource.cancel();
                statusBarItem.text = `${title} Cancelled`;
                setTimeout(() => statusBarItem.dispose(), 2000);
            }
        );

        // Start spinner animation
        spinnerUpdater.start();

        // Execute the long method
        const result = await longMethodPromise;

        // Update the status bar on success
        spinnerUpdater.stop();
        statusBarItem.text = `✔️ ${title} Completed`;
        setTimeout(() => statusBarItem.dispose(), 2000); // Remove after 2 seconds

        return result;
    } catch (error) {
        // Handle cancellation or failure
        statusBarItem.text = `${title} Cancelled`;
        setTimeout(() => statusBarItem.dispose(), 2000); // Remove after 2 seconds
        throw error;
    } finally {
        spinnerUpdater.stop();
        statusBarItem.dispose();
    }
}

export async function showProgress<T>(
    title: string,
    longMethod: (token: vscode.CancellationToken) => Promise<T>
): Promise<T> {

    const cancellation = new vscode.CancellationTokenSource();
    const longMethodPromise = longMethod(cancellation.token);
    showProgressStatus(title, longMethodPromise, cancellation);
    return showProgressWindow(title, longMethodPromise, cancellation);
}