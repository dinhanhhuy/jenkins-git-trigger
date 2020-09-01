require('dotenv').config();
const jenkins = require('jenkins');
const exec = require('child_process').exec;

const dataPath = process.env.DATA_PATH;

function execPromise(cmd) {
  return new Promise(function(resolve, reject) {
    exec(cmd, function(err, stdout) {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function initJenkins({ urlData, user, pass }) {
  const instance = jenkins({ baseUrl: `${urlData.protocol}://${user}:${pass}@${urlData.url}:${urlData.port}`, crumbIssuer: true });
  return instance;
}

async function setupGit({ user, pass, host, repo, branch }) {
  const data = `https://${user}:${pass}`;
  const encode = `https://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}`;
  const config = '[credential]\r\n\thelper = store'
  await execPromise(`echo "${config}" >> ~/.gitconfig`);
  await execPromise(`echo "${encode}" >> ~/.git-credentials`);
  await execPromise(`mkdir /app || true && cd /app && git clone --branch ${branch} ${repo} .`)
}

async function needTrigger({ branch }) {
  await execPromise('cd /app && git fetch --all');
  const origin = await execPromise(`cd /app && git rev-parse origin/${branch}`);  
  const local = await execPromise('cd /app && git rev-parse HEAD');
  return origin !== local;
}

async function start() {
  const jenkinsInstance = initJenkins({
    urlData: {
      protocol: process.env.JENKINS_PROTOCOL,
      url: process.env.JENKINS_URL,
      port: process.env.JENKINS_PORT,
    },
    user: process.env.JENKINS_USER,
    pass: process.env.JENKINS_PASS,
  });

  console.log(`[INFO]: setupGit`);
  await setupGit({
    user: process.env.GIT_USER,
    pass: process.env.GIT_PASS,
    host: process.env.GIT_HOST,
    repo: process.env.GIT_REPO,
    branch: process.env.GIT_BRANCH,
  });

  setInterval(async () => {
    const trigger = await needTrigger({ branch: process.env.GIT_BRANCH });
    console.log(`[INFO]: trigger ${trigger}`);
    if (trigger) {
      jenkinsInstance.job.build(
        { 
          name: process.env.JENKINS_JOB,
          token: process.env.JENKINS_TOKEN,
        }, 
        async function (err, data) {
          if (err) throw err;
          console.log(data);
          await execPromise('cd /app && git pull');
      });
    }
  }, process.env.SCHEDULE_MINUTE * 60 * 1000);
}


(async () => {
  await start();
})()