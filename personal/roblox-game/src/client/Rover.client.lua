-- Driving the Moon Rover (2026-10-18): while you sit in its seat, your screen steers it. WASD / arrow keys or the
-- tablet joystick come through the VehicleSeat as Throttle and Steer; the server hands you the rover while you drive.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local MAX_SPEED = 32 -- a bit faster than sprinting (27)
local REVERSE_SPEED = 14
local TURN_RATE = 1.9 -- radians per second at full lock
local ACCEL = 30 -- studs per second, per second

local speed, yaw, driving = 0, 0, nil

RunService.RenderStepped:Connect(function(dt)
	local ch = player.Character
	local hum = ch and ch:FindFirstChildOfClass("Humanoid")
	local seat = hum and hum.SeatPart
	if not (seat and seat:IsA("VehicleSeat") and seat:GetAttribute("Rover")) then
		driving, speed = nil, 0
		return
	end
	local rover = seat.Parent
	local hull = rover and rover.PrimaryPart
	local lv = hull and hull:FindFirstChildOfClass("LinearVelocity")
	local turn = hull and hull:FindFirstChildOfClass("AlignOrientation")
	if not (lv and turn) then
		return
	end
	if driving ~= seat then -- just got in: start from where it's pointing
		driving = seat
		local _, y = hull.CFrame:ToEulerAnglesYXZ()
		yaw, speed = y, 0
	end
	local throttle, steer = seat.ThrottleFloat, seat.SteerFloat
	local target = throttle > 0 and throttle * MAX_SPEED or throttle * REVERSE_SPEED
	if speed < target then
		speed = math.min(target, speed + ACCEL * dt)
	elseif speed > target then
		speed = math.max(target, speed - ACCEL * 1.5 * dt)
	end
	-- steer like a car: turning needs some speed, and flips when reversing
	local grip = math.clamp(math.abs(speed) / 8, 0.35, 1) * (speed < -0.5 and -1 or 1)
	yaw -= steer * TURN_RATE * grip * dt
	local heading = CFrame.Angles(0, yaw, 0)
	turn.CFrame = heading
	lv.VectorVelocity = heading.LookVector * speed
end)
