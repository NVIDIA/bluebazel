/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2023 NVIDIA Corporation
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
/////////////////////////////////////////////////////////////////////////////////////////
import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function showQuickPick(quickPickData: string[], onChange: (data: any)=>void) {
    const quickItems: vscode.QuickPickItem[] = [{ label: '' }];
    quickPickData.forEach(arg => { if (arg !== undefined && arg.trim().length > 0) { quickItems.push({ label: arg }); } });

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = quickItems;
    // Don't hide until a selection is made
    quickPick.ignoreFocusOut = true;

    quickPick.onDidChangeValue(value => {
        quickItems[0].label = value;
        quickPick.items = quickItems;
    });

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

    quickPick.show();
}