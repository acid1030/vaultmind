const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function authRemoteUrl(remoteUrl, accountUsername, secret) {
  const urlText = String(remoteUrl || '').trim();
  if (!secret || !/^https?:\/\//i.test(urlText)) return urlText;
  const url = new URL(urlText);
  const username = accountUsername ? String(accountUsername).trim() : 'token';
  url.username = encodeURIComponent(username);
  url.password = encodeURIComponent(secret);
  return url.toString();
}

function isGitRepository(localPath) {
  const root = String(localPath || '').trim();
  if (!root || !fs.existsSync(root)) return false;
  return fs.existsSync(path.join(root, '.git'));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeout || 120000,
      maxBuffer: 1024 * 1024 * 8,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (error) {
        reject(new Error(output || error.message));
        return;
      }
      resolve(output || 'OK');
    });
  });
}

async function gitRun(localPath, args, options = {}) {
  return runCommand('git', args, { cwd: localPath, ...options });
}

async function withAuthenticatedRemote(repo, runner) {
  const plainUrl = String(repo.remoteUrl || repo.remote_url || '').trim();
  const authUrl = authRemoteUrl(plainUrl, repo.accountUsername, repo.secret);
  if (!authUrl || authUrl === plainUrl || !isGitRepository(repo.localPath || repo.local_path)) {
    return runner();
  }
  const localPath = repo.localPath || repo.local_path;
  await gitRun(localPath, ['remote', 'set-url', 'origin', authUrl]);
  try {
    return await runner();
  } finally {
    try {
      await gitRun(localPath, ['remote', 'set-url', 'origin', plainUrl]);
    } catch {
      // Best effort restore remote URL without credentials.
    }
  }
}

async function inspectRepo(localPath, tool = 'git') {
  const cwd = String(localPath || '').trim();
  if (!cwd) return { exists: false, isRepo: false, tool };
  if (!fs.existsSync(cwd)) return { exists: false, isRepo: false, tool, localPath: cwd };
  if (tool === 'svn') {
    const isRepo = fs.existsSync(path.join(cwd, '.svn'));
    return { exists: true, isRepo, tool, localPath: cwd, label: isRepo ? 'SVN 工作副本' : '目录存在' };
  }
  if (!isGitRepository(cwd)) {
    return { exists: true, isRepo: false, tool: 'git', localPath: cwd, label: '未初始化 Git' };
  }
  try {
    const branch = await gitRun(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const status = await gitRun(cwd, ['status', '--short', '--branch']);
    const dirty = status.split('\n').some((line) => line && !line.startsWith('##'));
    const aheadBehind = (status.match(/^## .*?\[(.+?)\]/m) || [])[1] || '';
    return {
      exists: true,
      isRepo: true,
      tool: 'git',
      localPath: cwd,
      branch: branch.trim(),
      dirty,
      aheadBehind,
      shortStatus: status.split('\n').slice(0, 6).join('\n'),
      label: `${branch.trim()}${dirty ? ' · 有改动' : ''}${aheadBehind ? ` · ${aheadBehind}` : ''}`,
    };
  } catch (error) {
    return {
      exists: true,
      isRepo: true,
      tool: 'git',
      localPath: cwd,
      label: 'Git 仓库',
      error: String(error.message || error),
    };
  }
}

async function runGitAction(repo, action, input = {}) {
  const localPath = repo.localPath || repo.local_path;
  const remoteUrl = String(repo.remoteUrl || repo.remote_url || '').trim();
  const message = String(input.message || 'Update from VaultMind').trim() || 'Update from VaultMind';

  if (action === 'clone') {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    if (fs.existsSync(localPath) && fs.readdirSync(localPath).length > 0) {
      return '本地目录已存在且非空，未执行 clone。';
    }
    const cloneUrl = authRemoteUrl(remoteUrl, repo.accountUsername, repo.secret);
    return gitRun(process.cwd(), ['clone', cloneUrl, localPath]);
  }

  if (action === 'init') {
    fs.mkdirSync(localPath, { recursive: true });
    if (isGitRepository(localPath)) return '已是 Git 仓库，无需 init。';
    await gitRun(localPath, ['init']);
    if (remoteUrl) {
      await gitRun(localPath, ['remote', 'add', 'origin', remoteUrl]);
    }
    return remoteUrl ? `已初始化 Git 并添加 origin：${remoteUrl}` : '已初始化 Git 仓库。';
  }

  if (!fs.existsSync(localPath)) throw new Error('本地目录不存在，请先克隆或初始化');
  if (!isGitRepository(localPath)) throw new Error('本地目录不是 Git 仓库，请先克隆或点击「初始化 Git」');

  if (action === 'commit') {
    await gitRun(localPath, ['add', '-A']);
    return gitRun(localPath, ['commit', '-m', message]);
  }

  if (action === 'push') {
    return withAuthenticatedRemote(repo, () => gitRun(localPath, ['push', '-u', 'origin', 'HEAD']));
  }

  if (action === 'update' || action === 'pull') {
    return withAuthenticatedRemote(repo, () => gitRun(localPath, ['pull', '--ff-only']));
  }

  if (action === 'fetch') {
    return withAuthenticatedRemote(repo, () => gitRun(localPath, ['fetch', '--all', '--prune']));
  }

  const gitMap = {
    status: ['status', '--short', '--branch'],
    log: ['log', '--oneline', '--decorate', '-20'],
    diff: ['diff', '--stat'],
    branch: ['branch', '-vv'],
  };
  return gitRun(localPath, gitMap[action] || gitMap.status);
}

async function runSvnAction(repo, action, input = {}) {
  const localPath = repo.localPath || repo.local_path;
  const remoteUrl = String(repo.remoteUrl || repo.remote_url || '').trim();
  const message = String(input.message || 'Update from VaultMind').trim() || 'Update from VaultMind';

  if (action === 'clone') {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    if (fs.existsSync(localPath) && fs.readdirSync(localPath).length > 0) {
      return '本地目录已存在且非空，未执行 checkout。';
    }
    const args = ['checkout', remoteUrl, localPath];
    if (repo.accountUsername) args.push('--username', repo.accountUsername);
    if (repo.secret) args.push('--password', repo.secret, '--non-interactive', '--trust-server-cert');
    return runCommand('svn', args);
  }

  if (!fs.existsSync(localPath)) throw new Error('本地目录不存在，请先检出');

  const svnMap = {
    status: ['status'],
    update: ['update'],
    log: ['log', '-l', '20'],
    commit: ['commit', '-m', message],
  };
  return runCommand('svn', svnMap[action] || svnMap.status, { cwd: localPath });
}

module.exports = {
  authRemoteUrl,
  isGitRepository,
  inspectRepo,
  runGitAction,
  runSvnAction,
  runCommand,
};
