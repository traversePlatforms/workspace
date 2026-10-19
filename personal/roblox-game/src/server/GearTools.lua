-- The Gear Bay's items, built from simple parts (2026-10-18): the Boing Glove and Star Blaster as Roblox Tools,
-- the same shapes as spinning displays for the Gear Bay, and the Jet Boots that clip onto a player's feet.
-- A tool's "forward" is the Handle's -Z and "up" is its +Y, which is how a hand holds it with the arm raised.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)

local C = Config.Colors
local WHITE = Color3.fromRGB(240, 242, 248)
local STEEL = Color3.fromRGB(110, 118, 140)
local RED = Color3.fromRGB(235, 70, 60)

local GearTools = {}

local function piece(parent, root, name, size, color, offset, opts)
	opts = opts or {}
	local p = Instance.new(opts.wedge and "WedgePart" or "Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Material = opts.material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Massless = true
	if opts.ball then
		p.Shape = Enum.PartType.Ball
	elseif opts.cyl then
		p.Shape = Enum.PartType.Cylinder
	end
	if root then
		p.CFrame = root.CFrame * offset
		if not opts.noWeld then
			local w = Instance.new("WeldConstraint")
			w.Part0 = root
			w.Part1 = p
			w.Parent = p
		end
	end
	p.Parent = parent
	return p
end

local ALONG_Z = CFrame.Angles(0, math.rad(90), 0) -- turns a cylinder's length (its X) to run front to back

-- each builder fills `parent` around `handle` (already placed) and returns the parts the animations need
local BUILD = {}

function BUILD.glove(parent, handle)
	-- a launcher tube over the grip, a striped spring, and a big red glove that shoots out on a hit
	piece(parent, handle, "Tube", Vector3.new(2.2, 1.0, 1.0), WHITE, CFrame.new(0, 0.7, -0.7) * ALONG_Z, { cyl = true })
	piece(parent, handle, "TubeBand", Vector3.new(0.3, 1.1, 1.1), C.Orange, CFrame.new(0, 0.7, -1.6) * ALONG_Z, { cyl = true, material = Enum.Material.Neon })
	piece(parent, handle, "Trigger", Vector3.new(0.2, 0.4, 0.3), STEEL, CFrame.new(0, 0.05, -0.45))
	local rod = piece(parent, handle, "Spring", Vector3.new(1.4, 0.45, 0.45), Color3.fromRGB(200, 205, 215), CFrame.new(0, 0.7, -2.4) * ALONG_Z,
		{ cyl = true, material = Enum.Material.Metal, noWeld = true })
	local rodJoint = Instance.new("Motor6D")
	rodJoint.Name = "SpringJoint"
	rodJoint.Part0 = handle
	rodJoint.Part1 = rod
	rodJoint.C0 = CFrame.new(0, 0.7, -2.4) * ALONG_Z
	rodJoint.Parent = handle
	local glove = piece(parent, handle, "Glove", Vector3.new(1.9, 1.7, 1.9), RED, CFrame.new(0, 0.7, -3.6), { ball = true, noWeld = true })
	local gloveJoint = Instance.new("Motor6D")
	gloveJoint.Name = "GloveJoint"
	gloveJoint.Part0 = handle
	gloveJoint.Part1 = glove
	gloveJoint.C0 = CFrame.new(0, 0.7, -3.6)
	gloveJoint.Parent = handle
	piece(parent, glove, "Thumb", Vector3.new(0.7, 0.9, 0.8), RED, CFrame.new(0.85, 0.1, 0.1), { ball = true })
	piece(parent, glove, "Cuff", Vector3.new(0.5, 1.5, 1.5), WHITE, CFrame.new(0, 0, 0.9) * ALONG_Z, { cyl = true })
	piece(parent, glove, "Lace", Vector3.new(0.18, 0.18, 0.9), WHITE, CFrame.new(0, 0.82, 0.2))
	return { glove = glove }
end

function BUILD.blaster(parent, handle)
	-- a chunky white body, a glowing blue barrel with coils, and an orange star crystal at the muzzle
	piece(parent, handle, "Body", Vector3.new(0.9, 1.0, 2.4), WHITE, CFrame.new(0, 0.75, -0.6))
	piece(parent, handle, "Stripe", Vector3.new(0.95, 0.25, 2.0), C.Orange, CFrame.new(0, 1.0, -0.6), { material = Enum.Material.Neon })
	piece(parent, handle, "Barrel", Vector3.new(1.8, 0.55, 0.55), STEEL, CFrame.new(0, 0.75, -2.5) * ALONG_Z, { cyl = true, material = Enum.Material.Metal })
	for i = 0, 2 do
		piece(parent, handle, "Coil", Vector3.new(0.2, 0.8, 0.8), C.Blue, CFrame.new(0, 0.75, -1.9 - i * 0.45) * ALONG_Z, { cyl = true, material = Enum.Material.Neon })
	end
	local tip = piece(parent, handle, "Crystal", Vector3.new(0.6, 0.6, 0.6), C.Orange, CFrame.new(0, 0.75, -3.45), { ball = true, material = Enum.Material.Neon })
	piece(parent, handle, "Sight", Vector3.new(0.2, 0.4, 0.5), C.Blue, CFrame.new(0, 1.4, -1.2), { material = Enum.Material.Neon })
	for _, side in ipairs({ -1, 1 }) do
		piece(parent, handle, "Fin", Vector3.new(0.12, 0.7, 0.9), C.Blue, CFrame.new(side * 0.5, 1.1, 0.25) * CFrame.Angles(0, 0, side * -0.4), { wedge = true })
	end
	local muzzle = Instance.new("Attachment")
	muzzle.Name = "Muzzle"
	muzzle.Position = Vector3.new(0, 0.75, -3.8)
	muzzle.Parent = handle
	local light = Instance.new("PointLight")
	light.Name = "Flash"
	light.Color = C.Orange
	light.Range = 12
	light.Brightness = 0
	light.Parent = tip
	return { tip = tip }
end

local function newHandle(parent, at)
	local h = piece(parent, nil, "Handle", Vector3.new(0.45, 1.1, 0.6), Color3.fromRGB(60, 66, 86), nil, { material = Enum.Material.Metal })
	h.CFrame = at or CFrame.new()
	return h
end

-- a Tool for the backpack
function GearTools.tool(id)
	local def = Config.gearById(id)
	if not (def and BUILD[id]) then
		return nil
	end
	local tool = Instance.new("Tool")
	tool.Name = def.name
	tool.ToolTip = def.blurb
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	tool.Grip = CFrame.new(0, -0.1, 0) -- the hand closes round the middle of the grip
	tool:SetAttribute("GearId", id)
	tool:SetAttribute("Cooldown", def.cooldown or 0.6)
	tool:SetAttribute("Button", def.button or "USE")
	local handle = newHandle(tool)
	BUILD[id](tool, handle)
	return tool
end

-- the same shape, anchored, for the Gear Bay's display stands (Spin.client.lua turns it)
function GearTools.display(id, cframe, parent)
	local m = Instance.new("Model")
	m.Name = (Config.gearById(id) or {}).name or id
	if id == "boots" then
		local root = piece(m, nil, "Root", Vector3.new(0.2, 0.2, 0.2), STEEL, nil)
		root.Transparency = 1
		root.CFrame = cframe
		for _, side in ipairs({ -1, 1 }) do
			GearTools.boot(m, root, CFrame.new(side * 1.4, 0, 0) * CFrame.Angles(0, math.rad(180), 0), 2)
		end
		m.PrimaryPart = root
	else
		local handle = newHandle(m, CFrame.new())
		BUILD[id](m, handle)
		m.PrimaryPart = handle
		m:ScaleTo(2)
		-- centre it on the stand, side-on so you see its whole length
		local box = m:GetBoundingBox()
		m:PivotTo(cframe * CFrame.Angles(0, math.rad(90), 0) * box:ToObjectSpace(m:GetPivot()))
	end
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then
			p.Anchored = true
		elseif p:IsA("Motor6D") then
			p:Destroy() -- on display nothing needs to move by itself
		end
	end
	m.Parent = parent
	return m
end

-- one jet boot around `root` at `offset`; scale 1 fits a player's foot
function GearTools.boot(parent, root, offset, scale)
	scale = scale or 1
	local s = scale
	local shell = piece(parent, root, "JetBoot", Vector3.new(1.15, 0.9, 1.5) * s, WHITE, offset * CFrame.new(0, 0.05 * s, -0.05 * s))
	piece(parent, root, "BootToe", Vector3.new(1.1, 0.75, 0.9) * s, C.Orange, offset * CFrame.new(0, -0.05 * s, -0.75 * s), { ball = true })
	piece(parent, root, "BootBand", Vector3.new(1.2, 0.22, 1.55) * s, C.Blue, offset * CFrame.new(0, 0.35 * s, -0.05 * s), { material = Enum.Material.Neon })
	local nozzle = piece(parent, root, "BootJet", Vector3.new(0.35, 0.6, 0.6) * s, Color3.fromRGB(70, 76, 96), offset * CFrame.new(0, 0.1 * s, 0.8 * s) * ALONG_Z, { cyl = true, material = Enum.Material.Metal })
	nozzle:SetAttribute("JetNozzle", true)
	return shell
end

-- clip a pair onto a character's feet (R15 feet, or the bottom of R6 legs)
function GearTools.fitBoots(character)
	if character:FindFirstChild("JetBoots") then
		return
	end
	local folder = Instance.new("Folder")
	folder.Name = "JetBoots"
	folder.Parent = character
	for _, names in ipairs({ { "LeftFoot", "Left Leg" }, { "RightFoot", "Right Leg" } }) do
		local foot = character:FindFirstChild(names[1])
		local offset = CFrame.new(0, 0.25, 0) -- R15: lift the shell so it doesn't sink into the floor
		if not foot then
			foot = character:FindFirstChild(names[2])
			offset = CFrame.new(0, -0.6, 0)
		end
		if foot then
			GearTools.boot(folder, foot, offset, 1)
		end
	end
end

return GearTools
