// Global test setup (angular.json → test.options.setupFiles), run before each spec file.
//
// Component tests driven by Angular Material harnesses (selects, menus, paginators) can take a
// few seconds when the ~50 spec files run in parallel: the default 5 s timeout made them fail
// intermittently on a loaded machine.
vi.setConfig({ testTimeout: 15_000 });
