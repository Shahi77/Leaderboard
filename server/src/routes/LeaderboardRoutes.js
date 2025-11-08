const { Router } = require("express");

const leaderboardRouter = Router();

//TODO: add controllers
leaderboardRouter.get("/leaderboard");

module.exports = leaderboardRouter;
