import {Contract, ethers} from "ethers";
import {JsonRpcProvider} from "@ethersproject/providers";
import {abi} from "./abi.json";

export function listenOnVoteAttendance(){

    const networkInfo = {"name": "ganache", "chainId": 5777, "url": "http://127.0.0.1:7545"};
    const voteContractAddress = "tbd";

    const provider: JsonRpcProvider = new ethers.providers.JsonRpcProvider(networkInfo);
    const bridgeContract: Contract  = new ethers.Contract(voteContractAddress, abi, provider);

    bridgeContract.on("AttendanceSubmitted", (user, voteId, attendanceId) => {
        console.log("user:", user, "voteId:", voteId, "attendanceId:", attendanceId);
    });
}


async function start(){
    listenOnVoteAttendance();
}
start();