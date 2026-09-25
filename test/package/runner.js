'use strict';

const { spawnSync } = require('node:child_process');
const {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, dirname, join, parse, resolve, sep } = require('node:path');

const projectRoot = resolve(__dirname, '..', '..');
const safePackageRoot = join(
  projectRoot,
  'packages',
  'rpc-express-toolkit-safe'
);
const fixturesRoot = join(__dirname, 'fixtures');
const typesOnly = process.argv.includes('--types-only');
const unsupportedArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== '--types-only');

if (unsupportedArguments.length > 0) {
  throw new Error(`Unsupported argument: ${unsupportedArguments.join(', ')}`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd || projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
      ...options.env,
    },
    maxBuffer: 50 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();
    const signal = result.signal ? ` (signal ${result.signal})` : '';
    throw new Error(
      `${basename(command)} exited with status ${result.status}${signal}${
        output ? `\n${output}` : ''
      }`
    );
  }

  return result.stdout;
}

function runStep(label, action) {
  process.stdout.write(`[package-test] ${label} ... `);
  try {
    const result = action();
    process.stdout.write('ok\n');
    return result;
  } catch (error) {
    process.stdout.write('failed\n');
    throw error;
  }
}

function runNpm(arguments_, options = {}) {
  const npmOptions = {
    ...options,
    // `npm publish --dry-run` exports this setting to lifecycle scripts.
    // Package tests must still create and install their temporary tarballs.
    env: {
      npm_config_dry_run: 'false',
      ...options.env,
    },
  };

  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return run(
      process.execPath,
      [process.env.npm_execpath, ...arguments_],
      npmOptions
    );
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return run(npmCommand, arguments_, npmOptions);
}

function findPackageJson(packageName) {
  try {
    return require.resolve(`${packageName}/package.json`, {
      paths: [projectRoot],
    });
  } catch (packageJsonError) {
    let entryPath;
    try {
      entryPath = require.resolve(packageName, { paths: [projectRoot] });
    } catch (entryError) {
      throw new Error(
        `Cannot resolve local dev dependency "${packageName}". Run npm ci first.`,
        { cause: entryError }
      );
    }

    let currentDirectory = dirname(entryPath);
    const filesystemRoot = parse(currentDirectory).root;

    while (currentDirectory !== filesystemRoot) {
      const candidate = join(currentDirectory, 'package.json');
      if (existsSync(candidate)) {
        const manifest = readJson(candidate);
        if (manifest.name === packageName) {
          return candidate;
        }
      }
      currentDirectory = dirname(currentDirectory);
    }

    throw new Error(
      `Cannot locate package.json for local dev dependency "${packageName}".`,
      { cause: packageJsonError }
    );
  }
}

function getInstalledPackage(packageName) {
  const packageJsonPath = findPackageJson(packageName);
  return {
    manifest: readJson(packageJsonPath),
    root: dirname(packageJsonPath),
  };
}

function getPackageBin(packageName, binName) {
  const installedPackage = getInstalledPackage(packageName);
  const { bin } = installedPackage.manifest;
  const relativeBin =
    typeof bin === 'string'
      ? bin
      : bin && (bin[binName] || bin[basename(packageName)]);

  if (!relativeBin) {
    throw new Error(
      `Dev dependency "${packageName}" does not declare the "${binName}" binary.`
    );
  }

  const binPath = resolve(installedPackage.root, relativeBin);
  if (!existsSync(binPath)) {
    throw new Error(`Local binary does not exist: ${binPath}`);
  }
  return binPath;
}

function runLocalBin(packageName, binName, arguments_, options = {}) {
  return run(
    process.execPath,
    [getPackageBin(packageName, binName), ...arguments_],
    options
  );
}

function parsePackOutput(output) {
  const trimmedOutput = output.trim();
  const candidates = [trimmedOutput];
  const arrayStart = trimmedOutput.indexOf('[');

  if (arrayStart > 0) {
    candidates.push(trimmedOutput.slice(arrayStart));
  }

  const packResult = candidates
    .map((candidate) => {
      try {
        const parsed = JSON.parse(candidate);
        return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
      } catch (error) {
        return null;
      }
    })
    .find((candidate) => candidate !== null);

  if (packResult) {
    return packResult;
  }

  throw new Error(`Unable to parse npm pack --json output:\n${trimmedOutput}`);
}

function assertPackedFiles(packResult, requiredPaths) {
  const packedPaths = new Set(packResult.files.map((file) => file.path));
  const missingPaths = requiredPaths.filter(
    (filePath) => !packedPaths.has(filePath)
  );

  if (missingPaths.length > 0) {
    throw new Error(
      `Packed archive is missing required files: ${missingPaths.join(', ')}`
    );
  }
}

function assertPackedModes(packResult) {
  const invalidFiles = packResult.files.filter((file) => file.mode !== 0o644);

  if (invalidFiles.length > 0) {
    throw new Error(
      `${packResult.name} contains files without mode 0644: ${invalidFiles
        .map((file) => `${file.path} (${file.mode.toString(8)})`)
        .join(', ')}. Pack and publish from a native Linux filesystem.`
    );
  }
}

function removeTemporaryDirectory(directory) {
  const resolvedDirectory = resolve(directory);
  const temporaryRoot = `${resolve(tmpdir())}${sep}`;

  if (!resolvedDirectory.startsWith(temporaryRoot)) {
    throw new Error(
      `Refusing to remove non-temporary path: ${resolvedDirectory}`
    );
  }

  rmSync(resolvedDirectory, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 100,
  });
}

function executePackageTests() {
  const packageManifest = readJson(join(projectRoot, 'package.json'));
  const safePackageManifest = readJson(join(safePackageRoot, 'package.json'));
  const typescriptPackage = getInstalledPackage('typescript').manifest;

  if (!typescriptPackage.version.startsWith('6.')) {
    throw new Error(
      `Package tests require TypeScript 6.x, found ${typescriptPackage.version}.`
    );
  }

  const expressVersion = getInstalledPackage('express').manifest.version;
  const expressTypesVersion =
    getInstalledPackage('@types/express').manifest.version;
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'rpc-express-toolkit-package-test-')
  );

  try {
    const packResult = runStep('pack root package', () => {
      const output = runNpm(
        ['pack', '--json', '--pack-destination', temporaryDirectory],
        {
          cwd: projectRoot,
          env: { npm_config_dry_run: 'false' },
        }
      );
      return parsePackOutput(output);
    });

    assertPackedFiles(packResult, [
      'package.json',
      'src/index.js',
      'src/index.d.ts',
      'src/safe.js',
      'src/safe.d.ts',
    ]);
    assertPackedModes(packResult);

    const safePackResult = runStep('pack safe proxy package', () => {
      const output = runNpm(
        ['pack', '--json', '--pack-destination', temporaryDirectory],
        {
          cwd: safePackageRoot,
          env: { npm_config_dry_run: 'false' },
        }
      );
      return parsePackOutput(output);
    });

    assertPackedFiles(safePackResult, [
      'package.json',
      'index.js',
      'index.d.ts',
      'LICENSE',
    ]);
    assertPackedModes(safePackResult);

    const archivePath = join(temporaryDirectory, packResult.filename);
    if (!existsSync(archivePath)) {
      throw new Error(`npm pack did not create ${archivePath}`);
    }

    const safeArchivePath = join(temporaryDirectory, safePackResult.filename);
    if (!existsSync(safeArchivePath)) {
      throw new Error(`npm pack did not create ${safeArchivePath}`);
    }

    const consumerRoot = join(temporaryDirectory, 'consumer');
    mkdirSync(consumerRoot, { recursive: true });
    writeFileSync(
      join(consumerRoot, 'package.json'),
      `${JSON.stringify(
        {
          name: 'rpc-express-toolkit-package-consumer',
          version: '0.0.0',
          private: true,
        },
        null,
        2
      )}\n`
    );
    cpSync(fixturesRoot, join(consumerRoot, 'fixtures'), { recursive: true });

    runStep('install packed root and safe proxy tarballs', () =>
      runNpm(
        [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
          '--no-save',
          '--prefer-offline',
          archivePath,
          safeArchivePath,
          `express@${expressVersion}`,
          `@types/express@${expressTypesVersion}`,
        ],
        { cwd: consumerRoot }
      )
    );

    runStep('typecheck ESM consumer', () =>
      runLocalBin(
        'typescript',
        'tsc',
        [
          '--project',
          join(consumerRoot, 'fixtures', 'ts-esm', 'tsconfig.json'),
          '--pretty',
          'false',
        ],
        { cwd: consumerRoot }
      )
    );

    runStep('typecheck CommonJS consumer', () =>
      runLocalBin(
        'typescript',
        'tsc',
        [
          '--project',
          join(consumerRoot, 'fixtures', 'ts-cjs', 'tsconfig.json'),
          '--pretty',
          'false',
        ],
        { cwd: consumerRoot }
      )
    );

    if (!typesOnly) {
      runStep('smoke test ESM runtime', () =>
        run(process.execPath, [
          join(consumerRoot, 'fixtures', 'runtime-esm', 'index.mjs'),
        ])
      );

      runStep('smoke test CommonJS runtime', () =>
        run(process.execPath, [
          join(consumerRoot, 'fixtures', 'runtime-cjs', 'index.cjs'),
        ])
      );

      runStep('publint packed root tarball', () =>
        runLocalBin('publint', 'publint', ['run', archivePath, '--strict'])
      );

      runStep('publint packed safe proxy tarball', () =>
        runLocalBin('publint', 'publint', ['run', safeArchivePath, '--strict'])
      );

      runStep('ATTW packed root entrypoints', () =>
        runLocalBin(
          '@arethetypeswrong/cli',
          'attw',
          [
            archivePath,
            '--profile',
            'node16',
            '--entrypoints',
            '.',
            './safe',
            '--format',
            'table',
            '--no-emoji',
            '--no-color',
          ],
          { cwd: projectRoot }
        )
      );

      runStep('ATTW packed safe proxy entrypoint', () =>
        runLocalBin(
          '@arethetypeswrong/cli',
          'attw',
          [
            safeArchivePath,
            '--profile',
            'node16',
            '--entrypoints',
            '.',
            '--format',
            'table',
            '--no-emoji',
            '--no-color',
          ],
          { cwd: projectRoot }
        )
      );
    }

    const mode = typesOnly ? 'types only' : 'full matrix';
    console.log(
      `[package-test] passed ${packageManifest.name}@${packResult.version} ` +
        `and ${safePackageManifest.name}@${safePackResult.version} ` +
        `(${mode}, TypeScript ${typescriptPackage.version})`
    );
  } finally {
    removeTemporaryDirectory(temporaryDirectory);
  }
}

try {
  executePackageTests();
} catch (error) {
  console.error(`[package-test] failed: ${error.message}`);
  process.exitCode = 1;
}
