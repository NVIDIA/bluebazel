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
export const languageMapping: Map<string, string> = new Map([
    // Go
    ['go_', 'go'],

    // Python
    ['py_', 'python'],

    // C and C++
    ['c_', 'c'],
    ['cc_', 'cpp'],
    ['cpp_', 'cpp'],

    // Java
    ['java_', 'java'],

    // JavaScript and TypeScript
    ['js_', 'javascript'],
    ['ts_', 'typescript'],

    // Scala
    ['scala_', 'scala'],

    // Protocol Buffers
    ['proto_', 'protobuf'],

    // Shell/Bash
    ['sh_', 'shellscript'],

    // JSON
    ['json_', 'json'],

    // HTML and CSS
    ['html_', 'html'],
    ['css_', 'css'],

    // Ruby
    ['rb_', 'ruby'],

    // PHP
    ['php_', 'php'],

    // Rust
    ['rs_', 'rust'],

    // Swift
    ['swift_', 'swift'],

    // Kotlin
    ['kt_', 'kotlin'],
    ['kts_', 'kotlin'],

    // Lua
    ['lua_', 'lua'],

    // SQL
    ['sql_', 'sql'],

    // Markdown
    ['md_', 'markdown'],

    // XML
    ['xml_', 'xml'],

    // Dart
    ['dart_', 'dart'],

    // Haskell
    ['hs_', 'haskell'],

    // Erlang
    ['erl_', 'erlang'],
    ['hrl_', 'erlang'],

    // Clojure
    ['clj_', 'clojure'],
    ['cljs_', 'clojure'],

    // R
    ['r_', 'r'],

    // Visual Basic
    ['vb_', 'vb'],

    // CoffeeScript
    ['coffee_', 'coffeescript'],

    // F#
    ['fsharp_', 'fsharp'],

    // Groovy
    ['groovy_', 'groovy'],

    // YAML
    ['yaml_', 'yaml'],

    // PowerShell
    ['powershell_', 'powershell'],

    // Batch Scripting
    ['batch_', 'bat'],

    // Makefile
    ['make_', 'makefile'],

    // Dockerfile
    ['docker_', 'dockerfile'],

    // Racket
    ['rkt_', 'racket'],

    // Lisp and Scheme
    ['lisp_', 'lisp'],
    ['scheme_', 'scheme'],

    // Vala
    ['vala_', 'vala'],

    // Objective-C and Objective-C++
    ['objc_', 'objective-c'],
    ['objcxx_', 'objective-cpp'],

    // Nim
    ['nim_', 'nim'],

    // Elixir
    ['elixir_', 'elixir'],

    // Haxe
    ['haxe_', 'haxe'],

    // Fortran
    ['fortran_', 'fortran'],
]);

// Sort prefixes by length in descending order to prioritize longer, more specific prefixes
export const sortedBazelRuleTypePrefixes: string[] = Array.from(languageMapping.keys()).sort((a, b) => b.length - a.length);
