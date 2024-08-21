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

import { BazelTarget } from './bazel-target';
import { EventEmitter } from 'vscode';

export enum BazelTargetState {
    Idle = 'idle',
    Executing = 'executing',
    Debugging = 'debugging'
}

export class BazelTargetStateManager {
    private targetStateMap: Map<string, BazelTargetState> = new Map();

    // Event emitter to notify when target state changes
    private _onDidChangeTargetState: EventEmitter<BazelTarget> = new EventEmitter<BazelTarget>();

    // Event that consumers can subscribe to
    public readonly onDidChangeTargetState = this._onDidChangeTargetState.event;

    // Method to set the state of a target
    public setTargetState(target: BazelTarget, state: BazelTargetState): void {
        this.targetStateMap.set(target.id, state);
        // Emit event whenever the state is set
        this._onDidChangeTargetState.fire(target);
    }

    // Method to get the state of a target
    public getTargetState(target: BazelTarget): BazelTargetState {
        return this.targetStateMap.get(target.id) || BazelTargetState.Idle;
    }
}