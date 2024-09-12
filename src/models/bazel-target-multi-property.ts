/////////////////////////////////////////////////////////////////////////////////////////
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
/////////////////////////////////////////////////////////////////////////////////////////

import { BazelTarget } from './bazel-target';
import { BazelTargetPropertyHistory } from './bazel-target-property-history';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

export class BazelTargetMultiPropertyItem {
    constructor(public readonly label: string,
        public readonly id: string,
        private readonly target: BazelTargetMultiProperty
    ) {
    }

    public remove() {
        this.target.remove(this);
    }

    public update(value: string) {
        this.target.replace(value, this);
    }

    public get(): string {
        return this.label;
    }

    public toJSON() {
        return {
            label: this.label,
            id: this.id
        };
    }
}
export class BazelTargetMultiProperty {
    public readonly id: string = '';
    private readonly history: BazelTargetPropertyHistory;

    constructor(
        private readonly context: vscode.ExtensionContext,
        public readonly label: string,
        public readonly name: string,
        target: BazelTarget,
        private readonly toStringFn: (bazelTargetProperty: BazelTargetMultiProperty) => string
    ) {
        this.id = `${target.action}${name}For${target.detail}`;
        this.history = new BazelTargetPropertyHistory(context, name, 10);
    }

    public add(value: string) {
        const values = this.get();
        values.push(new BazelTargetMultiPropertyItem(value, uuidv4(), this));
        this.update(values);
        this.history.add(value);
    }

    public remove(item: BazelTargetMultiPropertyItem) {
        let values = this.get();
        values = values.filter(it => it.id !== item.id);
        this.update(values);
    }

    public replace(value: string, item: BazelTargetMultiPropertyItem) {
        let values = this.get();
        values = values.map(it => {
            if (it.id === item.id) {
                return new BazelTargetMultiPropertyItem(value, it.id, this);
            }
            return it;
        });
        this.history.add(value);
        this.update(values);
    }

    public update(values: BazelTargetMultiPropertyItem[]) {
        this.context.workspaceState.update(this.id, values);
    }

    public get(): BazelTargetMultiPropertyItem[] {
        const storedValues = this.context.workspaceState.get<BazelTargetMultiPropertyItem[]>(this.id) || [];

        // Re-create BazelTargetMultiPropertyItem instances, passing 'this' as the reference
        const values = storedValues.map(value => new BazelTargetMultiPropertyItem(value.label, value.id, this));
        return values; // Return the re-instantiated items with references to 'this'
    }

    public getHistory(): string[] {
        return this.history.getHistory();
    }

    public toStringArray(): string[] {
        const values = this.get();
        const stringValues: string[] = [];
        values.forEach(item => {
            stringValues.push(item.get());
        });
        return stringValues;
    }

    public toString(): string {
        return this.toStringFn(this);
    }
}

