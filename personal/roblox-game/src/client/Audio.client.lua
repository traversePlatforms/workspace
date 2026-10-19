-- Music (2026-10-18, Matthew: "is there any sound involved in this?"): a looping space track, a spooky drone instead
-- during Black Hole Night, and a music button (top right) to turn the music off and on. Sound effects are in FX.client.lua.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local FX = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("FX")
local player = Players.LocalPlayer
local C = Config.Colors

local function track(def, looped)
	local s = Instance.new("Sound")
	s.SoundId = "rbxassetid://" .. def.id
	s.Volume = def.volume or 0.3
	s.Looped = looped
	s.Parent = SoundService
	return s
end
local music = track(Config.Sounds.music, true)
local night = track(Config.Sounds.night, true)
local musicOn = true
local isNight = false

local function fade(s, to, secs)
	TweenService:Create(s, TweenInfo.new(secs or 1.5), { Volume = to }):Play()
end

local function refresh()
	if musicOn and not isNight then
		if not music.IsPlaying then
			music.Volume = 0
			music:Play()
		end
		fade(music, Config.Sounds.music.volume)
	else
		fade(music, 0, 0.8)
	end
	if isNight and musicOn then
		if not night.IsPlaying then
			night.Volume = 0
			night:Play()
		end
		fade(night, Config.Sounds.night.volume)
	else
		fade(night, 0, 1.5)
	end
end

FX.OnClientEvent:Connect(function(kind, a)
	if kind == "night" then
		isNight = true
		refresh()
		task.delay(a or Config.NightSeconds, function()
			isNight = false
			refresh()
		end)
	end
end)

-- the music button
local gui = Instance.new("ScreenGui")
gui.Name = "MusicButton"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")
local btn = Instance.new("TextButton")
btn.AnchorPoint = Vector2.new(1, 0)
btn.Position = UDim2.new(1, -16, 0, 60)
btn.Size = UDim2.fromOffset(150, 46)
btn.BackgroundColor3 = C.Dark
btn.BackgroundTransparency = 0.2
btn.Font = Enum.Font.FredokaOne
btn.TextScaled = true
btn.TextColor3 = C.Blue
btn.Text = "♪ Music: On"
btn.Parent = gui
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = btn
local pad = Instance.new("UIPadding")
pad.PaddingLeft, pad.PaddingRight, pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 10), UDim.new(0, 10), UDim.new(0, 6), UDim.new(0, 6)
pad.Parent = btn
btn.Activated:Connect(function()
	musicOn = not musicOn
	btn.Text = musicOn and "♪ Music: On" or "♪ Music: Off"
	btn.TextColor3 = musicOn and C.Blue or Color3.fromRGB(150, 150, 165)
	refresh()
end)

refresh()
