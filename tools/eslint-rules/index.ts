import maxCommentRun from './max-comment-run.ts';

/** Repo-local ESLint rules, registered in `eslint.config.mjs` as the `local` plugin. */
export default {
  meta: { name: 'local' },
  rules: { 'max-comment-run': maxCommentRun },
};
