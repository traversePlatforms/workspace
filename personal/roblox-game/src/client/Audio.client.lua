-- Music (2026-10-18, Matthew: "is there any sound involved in this?"): a looping space track, a spooky drone instead
-- during Black Hole Night, and a music button (top right) to turn the music off and on. Sound effects are in FX.client.lua.
-- (2026-11-07) At Splash Lagoon there's no Black Hole Night drone, and the park's own track plays once Config.Sounds.parkMusic
-- has an id; until then the station's music carries on there.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local FX = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("FX")
local player = Players.LocalPlayer
local C = Config.Colors

local function track(def, looped)
	local id = Config.soundId(def)
	if not id then
		return nil
	end
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = 0
	s.Looped = looped
	s.Parent = SoundService
	return s
end
local music = track(Config.Sounds.music, true)
local night = track(Config.Sounds.night, true)
local parkMusic = track(Config.Sounds.parkMusic, true) -- nil while it is a placeholder
local volumes = {}
if music then
	volumes[music] = Config.Sounds.music.volume or 0.25
end
if night then
	volumes[night] = Config.Sounds.night.volume or 0.5
end
if parkMusic then
	volumes[parkMusic] = Config.Sounds.parkMusic.volume or 0.25
end
local musicOn = true
local nightUntil = 0 -- from the "night" event, in case the attribute is late

local function fade(s, to, secs)
	TweenService:Create(s, TweenInfo.new(secs or 1.5), { Volume = to }):Play()
end

local lastKey = nil
local function refresh()
	local inPark = player:GetAttribute("Zone") == "park"
	local t = workspace:GetServerTimeNow()
	local isNight = not inPark and ((workspace:GetAttribute("BlackHoleUntil") or 0) > t or nightUntil > t)
	local main = (inPark and parkMusic) or music
	local want = nil -- the one track that should be playing
	if musicOn then
		want = isNight and night or main
	end
	local key = tostring(want)
	if key == lastKey then
		return
	end
	lastKey = key
	for s, vol in pairs(volumes) do
		if s == want then
			if not s.IsPlaying then
				s.Volume = 0
				s:Play()
			end
			fade(s, vol, 1.5)
		else
			fade(s, 0, 0.8)
		end
	end
end

FX.OnClientEvent:Connect(function(kind, a)
	if kind == "night" then
		nightUntil = workspace:GetServerTimeNow() + (a or Config.NightSeconds)
		refresh()
	end
end)
workspace:GetAttributeChangedSignal("BlackHoleUntil"):Connect(refresh)
player:GetAttributeChangedSignal("Zone"):Connect(refresh)
task.spawn(function() -- catches the end of a night, a switch of games, anything missed
	while true do
		task.wait(1)
		refresh()
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
