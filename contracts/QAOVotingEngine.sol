// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "./QAOToken.sol";

contract QAOVotingEngine is Ownable {

    struct Vote {
        address creator;
        uint256 timestamp;
        uint256 votePositive;
        uint256 voteNegative;
        bool valid;
        string heading;
        string description;
    }

    struct VoteAttendance {
        uint256 vote;
        uint256 amount;
        uint256 timestamp; // vote timestamp
        uint256 lockWeeks; // lock time in weeks
        bool position;
        bool withdrawn;
    }

    modifier validVote(uint256 voteId){
        require(voteId >= 0 && voteId <= _voteCounter, "QAO Vote Engine: Not a valid vote id.");
        _;
    }

    modifier validVoteAttendance(address user, uint256 attendanceId){
        require(attendanceId >= 0 && attendanceId <= _userToVoteAttendanceCounter[user], "QAO Vote Engine: Not a valid attendance id for user.");
        _;
    }

    event StartOfVote(uint256 voteId);
    event AttendanceSubmitted(address user, uint256 voteId, uint256 attendanceId);
    event AttendanceWithdrawn(address user, uint256 voteId, uint256 attendanceId);
    event QuorumReached(uint256 voteId);

    /**** MEMBERS ********************************************* */

    uint256 private _initialVoteStake = 100000000 ether;
    uint256 private _voteQuorum = 1000000000 ether;

    uint256 public constant VOTE_MAX_TIME = 1 weeks;
    uint256 private constant DIV_ACCURACY = 1 ether;

    uint256 public constant BURN_PER_VOTE = 0.0125 ether;
    uint256 public constant REWARD_PER_VOTE = 0.0125 ether;

    QAOToken private _qaoToken;
    address private _rewardPool;
    uint256 private _voteCounter = 0;

    mapping(uint256 => Vote) private _idToVote;

    mapping(address => uint256) private _userToVoteAttendanceCounter;
    mapping(address => mapping (uint256 => VoteAttendance)) private _userToVoteToAttendance;


    constructor(address qaoTokenAddr, address rewardPool) {
        _qaoToken = QAOToken(qaoTokenAddr);
        _rewardPool = rewardPool;
    }

    function qaoToken() external view returns (address) {
        return address(_qaoToken);
    }

    function createVote(string calldata heading, string calldata description, uint256 lockWeeks) external {

        require(_qaoToken.transferFrom(_msgSender(), address(this), _initialVoteStake), 
                "QAO Voting Engine: Not enough token approved to engine to init a vote.");
        
        require(lockWeeks > 0 && lockWeeks <= 520, 
                "QAO Voting Engine: Token locking time needs to be between 1 week and 10 years (520 weeks).");

        // *** step 2 - burn 1.25% and send 1.25% to reward pool
        uint256 burnAmount = (_initialVoteStake * BURN_PER_VOTE) / DIV_ACCURACY;
        uint256 rewardPoolAmount = (_initialVoteStake * REWARD_PER_VOTE) / DIV_ACCURACY;

        _qaoToken.burn(burnAmount);
        _qaoToken.transfer(_rewardPool, rewardPoolAmount);

        _idToVote[_voteCounter] = Vote(_msgSender(), block.timestamp, (_initialVoteStake - burnAmount - rewardPoolAmount), 0, false, heading, description);

        uint256 voteAttendanceId = _userToVoteAttendanceCounter[_msgSender()];
        _userToVoteToAttendance[_msgSender()][voteAttendanceId] = VoteAttendance(_voteCounter, (_initialVoteStake - burnAmount - rewardPoolAmount) , block.timestamp, lockWeeks, true, false);
        
        emit StartOfVote(_voteCounter);
        emit AttendanceSubmitted(_msgSender(), _voteCounter, voteAttendanceId);

        _voteCounter = _voteCounter + 1;
        _userToVoteAttendanceCounter[_msgSender()] = voteAttendanceId + 1;
    }


    function vote(uint256 voteId, uint256 tokenAmount, uint256 lockWeeks, bool position) external validVote(voteId) {

        // *** step 1 - pre-checks ***

        require(tokenAmount >= 1, 
                "QAO Voting Engine: Minimum 1 QAO for voting/staking");

        // check if vote is still active
        require(voteIsActive(voteId), "QAO Voting Engine: Vote is not active.");

        require(_qaoToken.transferFrom(_msgSender(), address(this), tokenAmount), 
                "QAO Voting Engine: Not enough token approved to engine to submit the vote.");

        require(lockWeeks > 0 && lockWeeks <= 520, 
                "QAO Voting Engine: Token locking time needs to be between 1 week and 10 years (520 weeks).");
        
        // *** step 2 - burn 1.25% and send 1.25% to reward pool
        uint256 burnAmount = (tokenAmount * BURN_PER_VOTE) / DIV_ACCURACY;
        uint256 rewardPoolAmount = (tokenAmount * REWARD_PER_VOTE) / DIV_ACCURACY;

        _qaoToken.burn(burnAmount);
        _qaoToken.transfer(_rewardPool, rewardPoolAmount);


        uint256 voteAttendanceId = _userToVoteAttendanceCounter[_msgSender()];
        _userToVoteToAttendance[_msgSender()][voteAttendanceId] = VoteAttendance(voteId, 
                                                                        (tokenAmount - burnAmount - rewardPoolAmount),
                                                                         block.timestamp, lockWeeks, position, false);
        
        emit AttendanceSubmitted(_msgSender(), voteId, voteAttendanceId);
        _userToVoteAttendanceCounter[_msgSender()] = voteAttendanceId + 1;

        // *** step 3 - update vote ***
        if (position){
            _idToVote[voteId].votePositive = _idToVote[voteId].votePositive + tokenAmount;
        }
        else {
            _idToVote[voteId].voteNegative = _idToVote[voteId].voteNegative + tokenAmount;
        }

        // check if vote quorum has been reached and thus the vote becomes valid
        if ((_idToVote[voteId].votePositive + _idToVote[voteId].voteNegative) >= _voteQuorum){
            _idToVote[voteId].valid = true;
            emit QuorumReached(voteId);
        }
    }


    function withdrawFromVoteAttendance(uint256 attendanceId) external validVoteAttendance(_msgSender(), attendanceId) {

        VoteAttendance memory voteAttendance = _userToVoteToAttendance[_msgSender()][attendanceId];
        require(!voteAttendance.withdrawn, "QAO Voting Engine: Token have already been withdrawn.");
        
        uint256 unlockTimestamp = voteAttendance.timestamp + voteAttendance.lockWeeks * 1 weeks;
        require(!voteIsActive(voteAttendance.vote), "QAO Voting Engine: Vote is still active.");
        require(block.timestamp >= unlockTimestamp, "QAO Voting Engine: Tokens are still locked.");

        _qaoToken.transfer(_msgSender(), voteAttendance.amount);
        _userToVoteToAttendance[_msgSender()][attendanceId].withdrawn = true;
        emit AttendanceWithdrawn(_msgSender(), voteAttendance.vote, attendanceId);
    }
        
    /*******************************************************************
     * Getters/ Setters for reward pool
     *******************************************************************/ 
     function rewardPool() external view returns (address) {
         return _rewardPool;
     }

     function setRewardPool(address newPool) external onlyOwner {
         require(newPool != address(0), "QAO Voting Engine: AddressZero cannot be reward pool");
         _rewardPool = newPool;
     } 
    
    /*******************************************************************
     * Getters/ Setters for general vote variables
     *******************************************************************/ 
         function initialVoteStake() external view returns (uint256) {
        return _initialVoteStake;
    }

    function setInitialVoteStake(uint256 newStake) external onlyOwner {
        _initialVoteStake = newStake;
    } 

    function voteQuorum() external view returns (uint256) {
        return _voteQuorum;
    }
    function setVoteQuorum(uint256 newQuorum) external onlyOwner {
        _voteQuorum = newQuorum;
    }

    /*******************************************************************
     * Vote Getters
     *******************************************************************/

    function getVote(uint256 voteId) external view validVote(voteId) 
        returns (address, uint256, uint256, uint256, bool, string memory, string memory) {

            Vote memory vote = _idToVote[voteId];

            return (vote.creator,
                    vote.timestamp,
                    vote.votePositive,
                    vote.voteNegative,
                    vote.valid,
                    vote.heading,
                    vote.description);
    }

    function voteIsActive(uint256 voteId) public view validVote(voteId) returns (bool) {
        return _idToVote[voteId].timestamp + VOTE_MAX_TIME > block.timestamp;
    }

    function voteSuccess(uint256 voteId) external view validVote(voteId) returns (bool) {
        return _idToVote[voteId].votePositive > _idToVote[voteId].voteNegative; 
    }


    /*******************************************************************
     * Attendance Getters
     *******************************************************************/
    
    function getAttendance(address user, uint256 attendanceId) external view validVoteAttendance(user, attendanceId)
        returns (uint256, uint256, uint256, uint256, bool, bool) {

            VoteAttendance memory attendance = _userToVoteToAttendance[user][attendanceId];

            return (attendance.vote,
                    attendance.amount,
                    attendance.timestamp,
                    attendance.lockWeeks,
                    attendance.position,
                    attendance.withdrawn);
    }

}