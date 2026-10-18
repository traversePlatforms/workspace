-- Sprint (2026-10-18, Matthew: "a sprint feature that has a meter to it that drains and slowly brings back up").
-- Hold Shift, or the Sprint button on a phone or tablet. The energy bar drains while you run and refills after you stop.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local S = Config.Sprint
local C = Config.Colors
local player = Players.LocalPlayer

local energy, wantRun, lastRun = 1, false, 0

local gui = Instance.new("ScreenGui")
gui.Name = "Sprint"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

-- the energy bar, bottom middle
local bar = Instance.new("Frame")
bar.AnchorPoint = Vector2.new(0.5, 1)
bar.Position = UDim2.new(0.5, 0, 1, -28)
bar.Size = UDim2.fromOffset(300, 26)
bar.BackgroundColor3 = C.Dark
bar.BackgroundTransparency = 0.15
bar.Parent = gui
local bc = Instance.new("UICorner")
bc.CornerRadius = UDim.new(1, 0)
bc.Parent = bar
local bs = Instance.new("UIStroke")
bs.Color = C.Blue
bs.Thickness = 2
bs.Parent = bar
local fill = Instance.new("Frame")
fill.Size = UDim2.fromScale(1, 1)
fill.BackgroundColor3 = C.Blue
fill.Parent = bar
local fc = Instance.new("UICorner")
fc.CornerRadius = UDim.new(1, 0)
fc.Parent = fill
local label = Instance.new("TextLabel")
label.Size = UDim2.fromScale(1, 1)
label.BackgroundTransparency = 1
label.Font = Enum.Font.FredokaOne
label.TextScaled = true
label.TextColor3 = Color3.new(1, 1, 1)
label.TextStrokeTransparency = 0.3
label.Text = "SPRINT (Shift)"
label.ZIndex = 2
label.Parent = bar

-- a Sprint button for touch screens
if UserInputService.TouchEnabled then
	label.Text = "SPRINT"
	local btn = Instance.new("TextButton")
	btn.AnchorPoint = Vector2.new(1, 1)
	btn.Position = UDim2.new(1, -260, 1, -24)
	btn.Size = UDim2.fromOffset(110, 70)
	btn.BackgroundColor3 = C.Blue
	btn.Font = Enum.Font.FredokaOne
	btn.TextScaled = true
	btn.TextColor3 = C.Dark
	btn.Text = "Sprint"
	btn.Parent = gui
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 16)
	c.Parent = btn
	btn.MouseButton1Down:Connect(function()
		wantRun = true
	end)
	btn.MouseButton1Up:Connect(function()
		wantRun = false
	end)
	btn.MouseLeave:Connect(function()
		wantRun = false
	end)
end

UserInputService.InputBegan:Connect(function(input, typing)
	if typing then
		return
	end
	if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift or input.KeyCode == Enum.KeyCode.ButtonL3 then
		wantRun = true
	end
end)
UserInputService.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift or input.KeyCode == Enum.KeyCode.ButtonL3 then
		wantRun = false
	end
end)

local tired = false -- once empty, you have to let it refill a bit before running again
RunService.Heartbeat:Connect(function(dt)
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	local moving = hum.MoveDirection.Magnitude > 0.1
	local running = wantRun and moving and energy > 0 and not tired
	if running then
		energy = math.max(0, energy - S.drainPerSecond / 100 * dt)
		lastRun = os.clock()
		if energy <= 0 then
			tired = true
		end
	elseif os.clock() - lastRun > S.refillDelay then
		energy = math.min(1, energy + S.refillPerSecond / 100 * dt)
		if tired and energy > 0.25 then
			tired = false
		end
	end
	hum.WalkSpeed = running and S.run or S.walk
	fill.Size = UDim2.fromScale(math.max(energy, 0.001), 1)
	fill.BackgroundColor3 = tired and Color3.fromRGB(150, 156, 176) or (running and C.Orange or C.Blue)
end)

player.CharacterAdded:Connect(function()
	energy, tired = 1, false
end)
