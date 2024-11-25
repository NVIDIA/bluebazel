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
                    cancellationSource.cancel(); // Propagate cancellation
                });

                const spinnerUpdater = createSpinnerUpdater((spinner) => {
                    progress.report({ increment: undefined, message: `${spinner}` });
                });

                try {
                    spinnerUpdater.start();
                    const result = await longMethodPromise;
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

    statusBarItem.text = `$(sync~spin) ${title}`;

    const cancelCommand = `${title}.cancel`;
    // Register the cancel command
    const disposable = vscode.commands.registerCommand(cancelCommand, () => {
        disposable.dispose();
        cancellationSource.cancel(); // Trigger cancellation
    });

    try {
        // Configure the status bar item
        statusBarItem.tooltip = 'Click to cancel';
        statusBarItem.command = cancelCommand;
        statusBarItem.show();

        // Await the long-running task
        const result = await longMethodPromise;

        statusBarItem.text = `${title} Completed`;
        setTimeout(() => statusBarItem.dispose(), 2000);

        return result;
    } catch (error) {
        statusBarItem.text = `${title} Cancelled`;
        setTimeout(() => statusBarItem.dispose(), 2000);
        throw error;
    } finally {
        statusBarItem.dispose();
        disposable.dispose();
    }
}

export async function showProgress<T>(
    title: string,
    longMethod: (token: vscode.CancellationToken) => Promise<T>,
    cancellationSource?: vscode.CancellationTokenSource,
    quiet = false
): Promise<T> {

    if (cancellationSource === undefined) {
        cancellationSource = new vscode.CancellationTokenSource();
    }

    const longMethodPromise = longMethod(cancellationSource.token);


    // Start both the status bar and progress window
    const statusPromise = showProgressStatus(title, longMethodPromise, cancellationSource);
    const promises = [statusPromise];
    if (!quiet) {
        const progressWindowPromise = showProgressWindow(title, longMethodPromise, cancellationSource);
        promises.push(progressWindowPromise);
    }
    // Ensure that cancellation or completion of one cancels/cleans up the other
    try {
        const result = await Promise.all(promises);
        return result[0]; // Return the actual result
    } catch (error) {
        cancellationSource.cancel(); // Ensure both are canceled
        throw error;
    }
}
