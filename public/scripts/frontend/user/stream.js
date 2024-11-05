"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const stream = document.getElementById('stream');
console.log(stream);
function streamLoop() {
    return __awaiter(this, void 0, void 0, function* () {
        //Local testing
        //const URL = 'http://localhost:3000/player/stream'
        //Deployment
        const URL = 'https://project-tagger-app.onrender.com/player/stream';
        const response = yield fetch(URL, {
            credentials: 'include'
        });
        if (response) {
            const json = yield response.json();
            stream.src = `data:${json['mimeType']};base64,${json['frame']}`;
        }
        requestAnimationFrame(streamLoop);
    });
}
requestAnimationFrame(streamLoop);
