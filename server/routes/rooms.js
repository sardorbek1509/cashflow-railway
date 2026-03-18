/**
 * Game Room Routes
 */

const express = require('express');
const router = express.Router();
const { createRoom, listRooms, getRoom, getRoomState } = require('../controllers/roomController');
const { authenticate } = require('../middleware/auth');
const { createRoomRules, validate } = require('../middleware/validation');

router.use(authenticate);

router.post('/', createRoomRules, validate, createRoom);
router.get('/', listRooms);
router.get('/:roomId', getRoom);
router.get('/:roomId/state', getRoomState);

module.exports = router;
