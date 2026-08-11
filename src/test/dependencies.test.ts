import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Package dependencies', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    test('keeps type-only packages out of runtime dependencies', () => {
        assert.ok(
            !packageJson.dependencies || !('@types/tmp' in packageJson.dependencies),
            '@types/tmp is a type-only package and must be listed in devDependencies'
        );
    });
