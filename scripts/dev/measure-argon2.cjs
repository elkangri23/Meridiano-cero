// Solo evaluación con contraseñas sintéticas; no implementa autenticación.
const { performance } = require('node:perf_hooks');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Usar Node 24 para esta evaluación.');
if (!process.argv[2]) throw new Error('Indicar carpeta temporal con argon2 0.45.1 instalado.');
const load = createRequire(resolve(process.argv[2], 'package.json'));
assert.equal(load('argon2/package.json').version, '0.45.1');
const argon2 = load('argon2');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function main() {
  const result = {
    node: process.version, argon2: '0.45.1', platform: process.platform,
    arch: process.arch, cpu: os.cpus()[0].model,
    availableParallelism: os.availableParallelism(), profiles: [],
  };
  for (const [memoryCost, timeCost] of [[19456, 2], [19456, 3], [65536, 3]]) {
    const options = { type: argon2.argon2id, memoryCost, timeCost, parallelism: 1, hashLength: 32 };
    const password = randomBytes(32).toString('base64url');
    const warm = await argon2.hash(password, options);
    const second = await argon2.hash(password, options);
    assert.notEqual(warm.split('$')[4], second.split('$')[4]);
    assert.ok(Buffer.from(warm.split('$')[4], 'base64').length >= 16);
    assert.equal(Buffer.from(warm.split('$')[5], 'base64').length, 32);
    const phc = warm.split('$');
    assert.equal(phc[1], 'argon2id');
    assert.equal(phc[2], 'v=19');
    const params = Object.fromEntries(phc[3].split(',').map(pair => {
      const [key, value] = pair.split('=');
      return [key, Number(value)];
    }));
    assert.deepEqual(params, { m: memoryCost, t: timeCost, p: 1 });
    const hashMs = [], verifyMs = [];
    for (let i = 0; i < 9; i++) {
      let start = performance.now();
      const hash = await argon2.hash(password, options);
      hashMs.push(performance.now() - start);
      start = performance.now();
      assert.equal(await argon2.verify(hash, password), true);
      verifyMs.push(performance.now() - start);
      assert.equal(await argon2.verify(hash, 'incorrecta-sintetica'), false);
    }
    const start = performance.now();
    await Promise.all([argon2.hash(password, options), argon2.hash(password, options)]);
    const twoConcurrentMs = performance.now() - start;
    result.profiles.push({
      memoryCostKiB: memoryCost, timeCost, parallelism: 1, hashLengthBytes: 32,
      samples: 9, hashMs, verifyMs, hashMedianMs: median(hashMs),
      hashMaxMs: Math.max(...hashMs), verifyMedianMs: median(verifyMs),
      verifyMaxMs: Math.max(...verifyMs), twoConcurrentMs,
      processMaxRssKiB: process.resourceUsage().maxRSS,
      checks: { correctPassword: true, wrongPasswordRejected: true,
        distinctSalts: true, saltAtLeast16Bytes: true, phcParameters: true },
    });
  }
  await assert.rejects(() => argon2.verify('no-es-un-hash-phc', 'sintetica'));
  result.malformedHashRejected = true;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
