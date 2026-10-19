-- Turns everything marked with a "SpinSpeed" attribute (degrees per second) on this player's screen only,
-- and sends a shooting star across the sky now and then. Nothing here touches the game rules.
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local station = workspace:WaitForChild("Station", 30)
if not station then
	return
end
local decor = station:WaitForChild("Decor", 30)
if not decor then
	return
end

local spinners = {}
for _, obj in ipairs(decor:GetDescendants()) do
	if (obj:IsA("BasePart") or obj:IsA("Model")) and obj:GetAttribute("SpinSpeed") then
		table.insert(spinners, { obj = obj, speed = math.rad(obj:GetAttribute("SpinSpeed")) })
	end
end
for _, obj in ipairs(decor:GetChildren()) do -- asteroids are models in the folder itself
	if obj:IsA("Model") and obj:GetAttribute("SpinSpeed") and obj.PrimaryPart then
		local seen = false
		for _, s in ipairs(spinners) do
			if s.obj == obj then
				seen = true
			end
		end
		if not seen then
			table.insert(spinners, { obj = obj, speed = math.rad(obj:GetAttribute("SpinSpeed")) })
		end
	end
end

-- the belt stripes in the launch tunnel travel with the critters and loop back to the start
local belt = {}
for _, obj in ipairs(decor:GetDescendants()) do
	if obj:IsA("BasePart") and obj:GetAttribute("Belt") then
		table.insert(belt, obj)
	end
end
local Config = require(game:GetService("ReplicatedStorage").Shared.Config)
RunService.RenderStepped:Connect(function(dt)
	for _, s in ipairs(belt) do
		local p = s.Position
		local x = p.X + Config.ConveyorSpeed * dt
		if x > 64 then
			x -= 129
		end
		s.CFrame = CFrame.new(x, p.Y, p.Z)
	end
end)

-- turn around the world's up axis through the object's own centre, keeping its tilt
local function turn(cf, a)
	return CFrame.new(cf.Position) * CFrame.Angles(0, a, 0) * (cf - cf.Position)
end

RunService.RenderStepped:Connect(function(dt)
	for _, s in ipairs(spinners) do
		local o = s.obj
		if o.Parent then
			if o:IsA("Model") then
				o:PivotTo(turn(o:GetPivot(), s.speed * dt))
			else
				o.CFrame = turn(o.CFrame, s.speed * dt)
			end
		end
	end
end)

-- things that bob up and down (the UFO) and lights that blink (rocket beacons) (2026-10-18)
local bobbers, blinkers = {}, {}
for _, obj in ipairs(decor:GetDescendants()) do
	if obj:IsA("Model") and obj:GetAttribute("Bob") then
		table.insert(bobbers, { obj = obj, h = obj:GetAttribute("Bob"), last = 0 })
	elseif obj:IsA("BasePart") and obj:GetAttribute("Blink") then
		table.insert(blinkers, obj)
	end
end
local clock = 0
RunService.RenderStepped:Connect(function(dt)
	clock += dt
	for _, b in ipairs(bobbers) do
		if b.obj.Parent then
			local y = math.sin(clock * 1.6) * b.h
			b.obj:PivotTo(b.obj:GetPivot() + Vector3.new(0, y - b.last, 0))
			b.last = y
		end
	end
	local on = math.floor(clock * 1.5) % 2 == 0
	for _, p in ipairs(blinkers) do
		p.Transparency = on and 0 or 0.85
	end
end)

-- shooting stars
local rng = Random.new()
task.spawn(function()
	while true do
		task.wait(rng:NextNumber(4, 9))
		local angle = rng:NextNumber(0, math.pi * 2)
		local start = Vector3.new(math.cos(angle) * 450, rng:NextNumber(120, 220), math.sin(angle) * 450)
		local dir = Vector3.new(-math.sin(angle), rng:NextNumber(-0.25, -0.05), math.cos(angle)).Unit
		local star = Instance.new("Part")
		star.Name = "ShootingStar"
		star.Anchored = true
		star.CanCollide = false
		star.CanQuery = false
		star.CanTouch = false
		star.CastShadow = false
		star.Material = Enum.Material.Neon
		star.Color = Color3.fromRGB(255, 240, 220)
		star.Size = Vector3.new(0.6, 0.6, 18)
		star.CFrame = CFrame.lookAt(start, start + dir)
		star.Parent = workspace
		local tw = TweenService:Create(star, TweenInfo.new(1.3, Enum.EasingStyle.Linear), { CFrame = CFrame.lookAt(start + dir * 320, start + dir * 321), Transparency = 1 })
		tw:Play()
		tw.Completed:Connect(function()
			star:Destroy()
		end)
	end
end)
