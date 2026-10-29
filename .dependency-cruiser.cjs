module.exports = {
  forbidden: [
    { name: 'web-no-backend-libraries', severity: 'error', from: { path: '^apps/web/src/' }, to: { path: '(^|/)(fastify|pg|drizzle-orm|argon2|@fastify)(/|$)' } },
    { name: 'web-no-node', severity: 'error', from: { path: '^apps/web/src/' }, to: { dependencyTypes: ['core'] } },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-unresolved', severity: 'error', from: {}, to: { couldNotResolve: true } },
    { name: 'packages-not-apps', severity: 'error', from: { path: '^packages/' }, to: { path: '^apps/' } },
    { name: 'web-isolation', severity: 'error', from: { path: '^apps/web/' }, to: { path: '^(apps/api/|packages/(engine|case-schema|ai-adapters|case-generator)/)' } },
    { name: 'api-not-web', severity: 'error', from: { path: '^apps/api/' }, to: { path: '^apps/web/' } },
    { name: 'public-contracts-only', severity: 'error', from: { path: '^packages/contracts/' }, to: { path: '^(apps/|packages/(?!contracts/))' } },
    { name: 'engine-no-server-integrity', severity: 'error', from: { path: '^packages/engine/', pathNot: '[.]test[.](ts|js)$' }, to: { path: '^packages/case-schema/(src|dist)/server[.](ts|js)$' } },
    { name: 'schema-root-pure', severity: 'error', from: { path: '^packages/case-schema/(src|dist)/index[.](ts|js)$' }, to: { path: '^packages/case-schema/(src|dist)/server[.](ts|js)$' } },
    { name: 'engine-pure', severity: 'error', from: { path: '^packages/engine/', pathNot: '[.]test[.]ts$' }, to: { dependencyTypes: ['core', 'npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown'] } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'], exportsFields: ['exports'], mainFields: ['module', 'main', 'types', 'typings'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
