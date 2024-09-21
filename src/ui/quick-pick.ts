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


// Overload signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function showSimpleQuickPick(quickPickData: string[], onChange: (data: any) => void): void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function showSimpleQuickPick(loadQuickPickData: (cancellationToken: vscode.CancellationToken) => Promise<string[]>, onChange: (data: any) => void, loadingLabel: string): void;

// Actual implementation
export function showSimpleQuickPick(
    quickPickDataOrLoader: string[] | ((cancellationToken: vscode.CancellationToken) => Promise<string[]>),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (data: any) => void,
    loadingLabel = 'Loading...'
): void {
    // Create the QuickPick with a loading message
    const quickPick = vscode.window.createQuickPick();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    quickPick.placeholder = loadingLabel;
    quickPick.items = [{ label: `$(sync~spin) ${loadingLabel}` }];
    quickPick.ignoreFocusOut = true;

    // Show the QuickPick immediately
    quickPick.show();

    // Determine if quickPickDataOrLoader is an array or a function returning a Promise
    let loadQuickPickData: Promise<string[]>;
    if (Array.isArray(quickPickDataOrLoader)) {
        // If it's an array, wrap it in a resolved promise
        loadQuickPickData = Promise.resolve(quickPickDataOrLoader);
    } else {
        // Otherwise, it's a function, so call it to get the promise
        loadQuickPickData = quickPickDataOrLoader(cancellationTokenSource.token);
    }

    // Load the actual data asynchronously
    loadQuickPickData.then(quickPickData => {
        quickPick.placeholder = '';
        // Once data is loaded, populate the QuickPick items
        const quickItems: vscode.QuickPickItem[] = [{ label: '' }];
        quickPickData.forEach(arg => {
            if (arg !== undefined && arg.trim().length > 0) {
                quickItems.push({ label: arg });
            }
        });

        // Set the loaded items in the QuickPick
        quickPick.items = quickItems;

        // Handle value change (updating the first item with user input)
        quickPick.onDidChangeValue(value => {
            quickItems[0].label = value;
            quickPick.items = quickItems;
        });

        // Handle selection change
        quickPick.onDidChangeSelection(items => {
            const item = items[0];
            quickPick.value = item.label;
            quickPick.hide();
            vscode.window.showInputBox({ value: item.label }).then(data => {
                if (data !== undefined) {
                    onChange(data);
                }
            });
        });

        quickPick.onDidHide(() => {
            cancellationTokenSource.cancel();
            cancellationTokenSource.dispose();
            quickPick.dispose();
        });

    }).catch(err => {
        // Handle any errors in loading the data
        vscode.window.showErrorMessage(`Error loading data: ${err}`);
        quickPick.hide();
    });
}
