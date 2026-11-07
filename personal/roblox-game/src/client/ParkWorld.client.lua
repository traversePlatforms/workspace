-- Splash Lagoon's sky on this player's screen (2026-11-07). Roblox has one Lighting and one gravity for the whole server, and the
-- station's events change them (Black Hole Night goes purple, Low Gravity floats everyone, the Captain changes the lights). So while
-- you're in the park, your own screen paints a bright sunny day with a little haze, and keeps your gravity normal: your character's
-- falling is worked out on your own device, so the station's low gravity never reaches you. Leaving the park puts the station's look
-- back, read from the attributes the server keeps on Lighting.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local Config = require(ReplicatedStorage.Shared.Config)
local player = Players.LocalPlayer

local WHITE = Color3.new(1, 1, 1)
local PARK = {
	ClockTime = 14,
	Brightness = 2,
	Ambient = Color3.fromRGB(150, 150, 158),
	OutdoorAmbient = Color3.fromRGB(160, 170, 186),
	FogColor = Color3.fromRGB(200, 232, 255),
	FogStart = 250,
	FogEnd = 1100, -- the station is 4,000 studs away: well inside the haze
	ExposureCompensation = 0,
}
local SKY = { StarCount = 0, CelestialBodiesShown = true }

local here = false
local applying = false -- set while this script changes things, so its own change doesn't call it again
local saved = nil -- the station's values for the things the server never changes after it starts

local function cc()
	return Lighting:FindFirstChildOfClass("ColorCorrectionEffect")
end
local function sky()
	return Lighting:FindFirstChildOfClass("Sky")
end
local function normalGravity()
	return workspace:GetAttribute("NormalGravity") or 196.2
end

local function set(obj, prop, value)
	if obj and obj[prop] ~= value then
		obj[prop] = value
	end
end

local function applyPark()
	applying = true
	local ok, err = pcall(function()
		for k, v in pairs(PARK) do
			set(Lighting, k, v)
		end
		set(cc(), "TintColor", WHITE)
		local s = sky()
		if s then
			for k, v in pairs(SKY) do
				set(s, k, v)
			end
		end
		set(workspace, "Gravity", normalGravity())
	end)
	applying = false
	if not ok then
		warn("[Splash Lagoon] park sky: " .. tostring(err))
	end
end

local function restore()
	if not saved then
		return
	end
	applying = true
	local ok, err = pcall(function()
		for k in pairs(PARK) do
			if saved[k] ~= nil then
				Lighting[k] = saved[k]
			end
		end
		-- the server changes these during the station's events: put back what they are now, not what they were when we left
		Lighting.Ambient = Lighting:GetAttribute("StAmbient") or saved.Ambient
		Lighting.OutdoorAmbient = Lighting:GetAttribute("StOutdoor") or saved.OutdoorAmbient
		Lighting.Brightness = Lighting:GetAttribute("StBrightness") or saved.Brightness
		local c = cc()
		if c then
			c.TintColor = Lighting:GetAttribute("StTint") or WHITE
		end
		local s = sky()
		if s and saved.sky then
			for k, v in pairs(saved.sky) do
				s[k] = v
			end
		end
		local low = (workspace:GetAttribute("LowGravityUntil") or 0) > workspace:GetServerTimeNow()
		workspace.Gravity = low and Config.LowGravityValue or normalGravity()
	end)
	applying = false
	if not ok then
		warn("[Splash Lagoon] putting the station sky back: " .. tostring(err))
	end
end

local function snapshot()
	saved = {}
	for k in pairs(PARK) do
		saved[k] = Lighting[k]
	end
	local s = sky()
	if s then
		saved.sky = {}
		for k in pairs(SKY) do
			saved.sky[k] = s[k]
		end
	end
end

local function update()
	local want = player:GetAttribute("Zone") == "park"
	if want == here then
		return
	end
	here = want
	if here then
		if not saved then
			snapshot()
		end
		applyPark()
	else
		restore()
	end
end
player:GetAttributeChangedSignal("Zone"):Connect(update)
update()

-- the server's own changes (a Black Hole Night starting, low gravity) arrive here too: paint the park's back over them straight away
Lighting.Changed:Connect(function(prop)
	if here and not applying and PARK[prop] ~= nil then
		applyPark()
	end
end)
workspace:GetPropertyChangedSignal("Gravity"):Connect(function()
	if here and not applying then
		applyPark()
	end
end)
local function watchCC(c)
	if c:IsA("ColorCorrectionEffect") then
		c:GetPropertyChangedSignal("TintColor"):Connect(function()
			if here and not applying then
				applyPark()
			end
		end)
	end
end
for _, c in ipairs(Lighting:GetChildren()) do
	watchCC(c)
end
Lighting.ChildAdded:Connect(watchCC)

-- and once a second, in case anything slipped past
task.spawn(function()
	while true do
		task.wait(1)
		if here then
			applyPark()
		end
	end
end)
