// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "./QAOToken.sol";

contract QAOVotingEngine is Ownable {

  struct Vote {
    address creator;
    uint256 timestamp;
  }

  struct VoteAttendance {
    address voter;
    uint256 vote;
    uint256 amount;
    uint256 timestamp;
    uint256 lockWeeks;
    bool position;
    bool withdrawn;
  }

  modifier validVote(uint256 voteId){
    require(voteId >= 0 && voteId <= _voteCounter, "QAO Vote Engine: Not a valid vote id.");
    _;
  }

  modifier validVoteAttendance(uint256 attendanceId){
    require(attendanceId >= 0 && attendanceId <= _voteAttendanceCounter, "QAO Vote Engine: Not a valid attendance id.");
    _;
  }

  event StartOfVote(uint256 voteId);
  event AttendanceSubmitted(uint256 attendanceId);
  event AttendanceWithdrawn(uint256 attendanceId);

  /**** MEMBERS ********************************************* */

  uint256 private _initialVoteStake = 100000000 ether;

  uint256 public constant VOTE_MAX_TIME = 1 weeks;
  uint256 private constant DIV_ACCURACY = 1 ether;

  uint256 public constant BURN_PER_VOTE = 0.0125 ether;
  uint256 public constant REWARD_PER_VOTE = 0.0125 ether;

  QAOToken private _qaoToken;
  address private _rewardPool;
  uint256 private _voteCounter = 0;
  uint256 private _voteAttendanceCounter = 0;

  mapping(uint256 => Vote) private _idToVote;
  mapping(uint256 => VoteAttendance) private _idToVoteAttendance;


  constructor(address qaoTokenAddr, address rewardPool) {
    _qaoToken = QAOToken(qaoTokenAddr);
    _rewardPool = rewardPool;
  }

  function qaoToken() external view returns (address) {
    return address(_qaoToken);
  }

  function createVote(uint256 lockWeeks) external {
    require(
      _qaoToken.transferFrom(_msgSender(), address(this), _initialVoteStake), 
      "QAO Voting Engine: Not enough token approved to engine to init a vote."
    );
    
    require(
      lockWeeks > 0 && lockWeeks <= 520, 
      "QAO Voting Engine: Token locking time needs to be between 1 week and 10 years (520 weeks)."
    );

    // *** step 2 - burn 1.25% and send 1.25% to reward pool
    uint256 burnAmount = (_initialVoteStake * BURN_PER_VOTE) / DIV_ACCURACY;
    uint256 rewardPoolAmount = (_initialVoteStake * REWARD_PER_VOTE) / DIV_ACCURACY;

    _qaoToken.burn(burnAmount);
    _qaoToken.transfer(_rewardPool, rewardPoolAmount);

    _idToVote[_voteCounter] = Vote(_msgSender(), block.timestamp);

    _idToVoteAttendance[_voteAttendanceCounter] = VoteAttendance(
      _msgSender(),
      _voteCounter,
      (_initialVoteStake - burnAmount - rewardPoolAmount),
      block.timestamp,
      lockWeeks,
      true,
      false
    );
    
    emit StartOfVote(_voteCounter);
    emit AttendanceSubmitted(_voteAttendanceCounter);

    _voteCounter = _voteCounter + 1;
    _voteAttendanceCounter = _voteAttendanceCounter + 1;
  }


  function vote(uint256 voteId, uint256 tokenAmount, uint256 lockWeeks, bool position) external validVote(voteId) {
    require(
      tokenAmount >= 1, 
      "QAO Voting Engine: Minimum 1 QAO for voting/staking"
    );
    require(voteIsActive(voteId), "QAO Voting Engine: Vote is not active.");
    require(
      _qaoToken.transferFrom(_msgSender(), address(this), tokenAmount), 
      "QAO Voting Engine: Not enough token approved to engine to submit the vote."
    );
    require(
      lockWeeks > 0 && lockWeeks <= 520, 
      "QAO Voting Engine: Token locking time needs to be between 1 week and 10 years (520 weeks)."
    );

    uint256 burnAmount = (tokenAmount * BURN_PER_VOTE) / DIV_ACCURACY;
    uint256 rewardPoolAmount = (tokenAmount * REWARD_PER_VOTE) / DIV_ACCURACY;
    _qaoToken.burn(burnAmount);
    _qaoToken.transfer(_rewardPool, rewardPoolAmount);
    
    _idToVoteAttendance[_voteAttendanceCounter] = VoteAttendance(
      _msgSender(),
      voteId, 
      (tokenAmount - burnAmount - rewardPoolAmount),
      block.timestamp,
      lockWeeks,
      position,
      false
    );

    emit AttendanceSubmitted(_voteAttendanceCounter);
    _voteAttendanceCounter = _voteAttendanceCounter + 1;
  }


  function withdrawFromVoteAttendance(uint256 attendanceId) external validVoteAttendance(attendanceId) {
    VoteAttendance memory voteAttendance = _idToVoteAttendance[attendanceId];
    require(!voteAttendance.withdrawn, "QAO Voting Engine: Token have already been withdrawn.");
    
    uint256 unlockTimestamp = voteAttendance.timestamp + voteAttendance.lockWeeks * 1 weeks;
    require(!voteIsActive(voteAttendance.vote), "QAO Voting Engine: Vote is still active.");
    require(block.timestamp >= unlockTimestamp, "QAO Voting Engine: Tokens are still locked.");

    _qaoToken.transfer(voteAttendance.voter, voteAttendance.amount);
    _idToVoteAttendance[attendanceId].withdrawn = true;
    emit AttendanceWithdrawn(attendanceId);
  }
      
  function getRewardPool() external view returns (address) {
    return _rewardPool;
  }

  function setRewardPool(address newPool) external onlyOwner {
    require(newPool != address(0), "QAO Voting Engine: AddressZero cannot be reward pool");
    _rewardPool = newPool;
  } 
  
  function getInitialVoteStake() external view returns (uint256) {
    return _initialVoteStake;
  }

  function setInitialVoteStake(uint256 newStake) external onlyOwner {
    _initialVoteStake = newStake;
  }

  function getVote(uint256 voteId) external view validVote(voteId) returns (address, uint256) {
    Vote memory currentVote = _idToVote[voteId];
    return (
      currentVote.creator,
      currentVote.timestamp
    );
  }

  function voteIsActive(uint256 voteId) public view validVote(voteId) returns (bool) {
    return _idToVote[voteId].timestamp + VOTE_MAX_TIME > block.timestamp;
  }

  function getAttendance(uint256 attendanceId) external view validVoteAttendance(attendanceId)
  returns (address, uint256, uint256, uint256, uint256, bool, bool) {
    VoteAttendance memory attendance = _idToVoteAttendance[attendanceId];
    return (
      attendance.voter,
      attendance.vote,
      attendance.amount,
      attendance.timestamp,
      attendance.lockWeeks,
      attendance.position,
      attendance.withdrawn
    );
  }
}