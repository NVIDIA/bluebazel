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
import { BazelService } from '../services/bazel-service';
import * as vscode from 'vscode';

/**
 * Model for retrieving all possible commands in bazel.
 */
export class BazelActionManager {
    private actions: string[] = [];
    private actionsPromise: Promise<string[]>;

    constructor(private context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
    ) {
        this.actionsPromise = this.loadActions();
    }

    private async loadActions(): Promise<string[]> {
        this.actions = await this.bazelService.fetchTargetActions();
        return this.actions;
    }

    public async getActions(): Promise<string[]> {
        return this.actionsPromise;
    }

    public async refreshActions() {
        this.actions = await this.bazelService.fetchTargetActions();
        this.actionsPromise = Promise.resolve(this.actions);
    }
}