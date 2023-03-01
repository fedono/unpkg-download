import axios from 'axios';
import pMap from 'p-map';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const axiosInstance = axios.create();
const unpkgUrl = 'https://unpkg.com/';
const unpkgBrowseUrl = `${unpkgUrl}browse/`;

async function index(packageName, version, entry = '') {
  const pkgName = `${packageName}@${version}`;
  let pkgBrowseUrl = `${unpkgBrowseUrl}${pkgName}`;
  let pkgFileUrl = `${unpkgUrl}${pkgName}`;
  getFiles(entry);

  async function getFiles(dir) {
    const url = `${pkgBrowseUrl}${dir}/`;
    try {
      const res = await axiosInstance.request({
        url
      });

      const { status, data } = res;
      if (status === 200) {
        let filesDescStr = /("filename"[\w :\{\},"\/\.\-+]+)/.exec(data);
        filesDescStr = `{${filesDescStr[1]}`;
        const getFileDesc = new Function('files', 'return JSON.parse(files);');
        const filesDesc = getFileDesc(filesDescStr);
        const details = filesDesc.target.details;
        const dirs = [];
        const files = [];
        Object.keys(details).forEach((filename) => {
          const { path, type } = details[filename];
          if (type === 'directory') {
            dirs.push(path);
          } else {
            files.push(path);
          }
        });

        if (dirs.length) {
          getDirFiles(dirs);
        }

        if (files.length) {
          downloadFiles(files);
        }
      }
    } catch (e) {
      console.log(url, e.message, '--- get dir error');
    }
  }

  async function getDirFiles(dirs) {
    // 其实可以不用这个，unpkg 作为一个 CDN，怎么可能有这种限制
    await pMap(dirs, getFiles, {
      concurrency: 6
    });
  }

  async function downloadFiles(files) {
    await pMap(files, downloadFile, {
      concurrency: 6
    });
  }

  async function downloadFile(file, retried = false) {
    let url = `${pkgFileUrl}${file}`;
    try {
      const res = await axiosInstance.request({
        url
      });
      let { status, data } = res;
      if (status === 200) {
        const filepath = file.replace(/(?!.*\/).*/, '');
        const dirpath = path.join(pkgName, filepath);
        if (!fs.existsSync(dirpath)) {
          fs.mkdirSync(dirpath, { recursive: true });
        }

        if (
          !(typeof data === 'string' || data instanceof ArrayBuffer || data instanceof DataView)
        ) {
          data = JSON.stringify(data);
        }
        fs.writeFile(
          path.join(__dirname, pkgName, file),
          data,
          {
            encoding: 'utf8',
            flag: 'w'
          },
          (err) => {
            if (err) {
              console.log(url, err.message, '--- file write error');
            }
          }
        );
      }
    } catch (e) {
      if (!retried) {
        console.log(url, e.message, '--- download file error');
        setTimeout(() => {
          downloadFile(file, true);
        }, 3 * 1000);
      } else {
        // 如果之前重试过了，那么当前 url 就不要再重试了
        console.log(url, e.message, '--- download file error occurred twice');
      }
    }
  }
}
// amis-editor@5.2.1-beta.33/
// index('amis-editor', '5.2.0');
// index('amis-editor', '5.2.0-beta.1'); //https://unpkg.com/browse/amis-editor@5.2.0-beta.1/
// index('amis-editor-comp', '0.1.0-beta.10'); //https://unpkg.com/browse/amis-editor@5.2.0-beta.1/
// index('amis-editor-core', '5.2.0-beta.1'); //https://unpkg.com/browse/amis-editor@5.2.0-beta.1/
// index('amis-editor', '5.2.0-beta.2'); //https://unpkg.com/browse/amis-editor@5.2.0-beta.1/
// index('amis-editor-core', '5.2.0-beta.2'); //https://unpkg.com/browse/amis-editor@5.2.0-beta.1/
// index('amis-editor', '5.2.1-beta.33'); //https://unpkg.com/browse/amis-editor@5.2.0-beta.1/
index('amis-editor-core', '5.2.1-beta.33'); //https://unpkg.com/browse/amis-editor@5.2.0-beta.1/