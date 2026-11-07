import type { RepoFiles } from './types'

/** An in-memory repository: for tests and fixtures. */
export function memoryRepo(files: Record<string, string>): RepoFiles {
  const normalised = new Map(Object.entries(files).map(([k, v]) => [k.replace(/^\.\//, ''), v]))
  return {
    read: (path) => normalised.get(path.replace(/^\.\//, '')) ?? null,
    list: (dir) => {
      const prefix = dir.replace(/^\.\//, '').replace(/\/?$/, '/')
      return [...normalised.keys()].filter((k) => k.startsWith(prefix))
    },
  }
}

/** Files under `dir` whose names match `pattern`. */
export function filesMatching(repo: RepoFiles, dir: string, pattern: RegExp): string[] {
  return repo.list(dir).filter((f) => pattern.test(f))
}

/** Concatenated contents of the files under `dir` matching `pattern`. */
export function readAll(repo: RepoFiles, dir: string, pattern: RegExp): { file: string; text: string }[] {
  return filesMatching(repo, dir, pattern).map((file) => ({ file, text: repo.read(file) ?? '' }))
}
