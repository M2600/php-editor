/**
 * ユーティリティヘルパー関数
 */

export function hideAllPreviewer(){
    let viewers = document.querySelectorAll(".viewer");
    viewers.forEach((viewer) => {
        viewer.style.display = "none";
    })
}

export function pathFromDir(path){
    let dir = path.replace(/\+$/, "");
    return dir;
}

export function getParentDir(path){
    let dir = path.replace(/\/+$/, "");
    dir = dir.substring(0, dir.lastIndexOf("/"));
    if(dir == ""){
        dir = "/";
    }
    if(dir[dir.length - 1] != "/"){
        dir += "/";
    }
    return dir;
}

export function fileNameCheck(fileName) {
    const allowedChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.";

    if (fileName.length == 0) {
        return false;
    }

    for (let i = 0; i < fileName.length; i++) {
        if (allowedChars.indexOf(fileName[i]) == -1) {
            return false;
        }
    }
    return true;
}

export function sessionError() {
    console.error("Session error");
    window.location.href = "/login.php";
}

export function getCurrentPath(baseDir) {
    return baseDir;
}

export function currentSubDir(path) {
    let dir = path.replace(/\/+/g, "/");
    // この関数の実装が不完全なので空のままにします
}
