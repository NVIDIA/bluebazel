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
interface HistoryMap {
    [key: string]: string[]
}

export class BazelTargetPropertyHistory {

    private historyMap: HistoryMap = {};
    private readonly DEFAULT_TARGET: string = 'DEFAULT_TARGET';
    private readonly key: string;
    constructor(private readonly context: vscode.ExtensionContext,
        readonly name: string,
        readonly size: number) {

        this.key = `${name}History`;
        const res = this.context.workspaceState.get<HistoryMap>(this.key);
        if (res === undefined) {
            const newRes: HistoryMap = {};
            this.historyMap = newRes;
            this.context.workspaceState.update(this.key, this.historyMap);
        } else {
            this.historyMap = res;
        }
    }

    public getFirstHistoryItem(target?: string): string {
        target = target || this.DEFAULT_TARGET;
        const result = this.historyMap[target];
        if (result !== undefined && result.length > 0) {
            return result[0];
        }
        return '';
    }

    public getHistory(target?: string): string[] {
        target = target || this.DEFAULT_TARGET;
        if (this.historyMap[target] === undefined) {
            return [];
        }
        return this.historyMap[target];
    }

    public add(value: string, target?: string) {
        target = target || this.DEFAULT_TARGET;
        let history = this.historyMap[target];
        if (history === undefined) {
            history = [];
        }

        if (history.includes(value)) {
            // If this value is in the history, delete it, as we'll re-add it to the beginning.
            const index = history.indexOf(value);
            history.splice(index, 1);
        }

        history.unshift(value);
        // Remove the last element to keep history size reasonable.
        if (history.length > this.size) {
            history.pop();
        }
        this.historyMap[target] = history;
        this.context.workspaceState.update(this.key, this.historyMap);
    }
}