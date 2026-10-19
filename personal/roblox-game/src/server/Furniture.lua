-- Furniture for the bases (2026-10-18, Matthew: "furniture in the base you can interact with, maybe a furniture store").
-- Each piece is built from parts around a floor-level origin, front facing -Z. The same builder makes the spinning displays
-- in the Space Furniture shop (display = true: seats switched off, nothing to bounce on).
-- SLOTS place each piece in a base, in the base's own coordinates (front = the doorway, local -Z), clear of the pedestals
-- (rows at z 15, 6 and -4, x ±18 and ±6), the doorway path (x -9..9) and the door console.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)

local C = Config.Colors
local Furniture = {}

Furniture.SLOTS = {
	beanbag = CFrame.new(-17, 1.1, -14) * CFrame.Angles(0, math.rad(-60), 0),
	bed = CFrame.new(24.6, 1.1, 10),
	disco = CFrame.new(0, 1.1, 10.5),
	trampoline = CFrame.new(16, 1.1, -15),
	telescope = CFrame.new(-24.5, 1.1, 14) * CFrame.Angles(0, math.rad(180), 0),
	arcade = CFrame.new(-25.6, 1.1, 2) * CFrame.Angles(0, math.rad(-90), 0),
}

local function newPart(m, root, name, size, color, offset, opts)
	opts = opts or {}
	local p = Instance.new(opts.class or "Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Material = opts.material or Enum.Material.SmoothPlastic
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.CanCollide = opts.collide ~= false
	if opts.ball then
		p.Shape = Enum.PartType.Ball
	elseif opts.cyl then
		p.Shape = Enum.PartType.Cylinder
	elseif opts.sphere then
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.Sphere
		mesh.Parent = p
	end
	if opts.transparency then
		p.Transparency = opts.transparency
	end
	p.CFrame = root * offset
	p.Parent = m
	return p
end

local UP = CFrame.Angles(0, 0, math.rad(90)) -- a cylinder standing upright
local ALONG_Z = CFrame.Angles(0, math.rad(90), 0)

local BUILD = {}

function BUILD.beanbag(m, at, display)
	newPart(m, at, "Bag", Vector3.new(5, 2.6, 5), C.Orange, CFrame.new(0, 1.2, 0), { sphere = true, material = Enum.Material.Fabric })
	newPart(m, at, "BagBack", Vector3.new(4.4, 3, 2.2), Color3.fromRGB(240, 165, 105), CFrame.new(0, 2.2, 1.4) * CFrame.Angles(math.rad(-15), 0, 0), { sphere = true, material = Enum.Material.Fabric })
	local seat = newPart(m, at, "Seat", Vector3.new(2.4, 0.4, 2.4), C.Orange, CFrame.new(0, 2.1, -0.2), { class = "Seat", transparency = 1 })
	seat.Disabled = display
	return seat
end

function BUILD.bed(m, at, display)
	-- a rocket lying down: a white body, a pointed orange end at the head, fins at the foot, a blue blanket
	newPart(m, at, "BedBody", Vector3.new(4.2, 1.6, 7), C.Trim, CFrame.new(0, 1.0, 0))
	for i, r in ipairs({ 2.1, 1.6, 1.0, 0.45 }) do
		newPart(m, at, "BedNose", Vector3.new(0.5, r * 2, r * 2) * Vector3.new(1, 0.62, 1), C.Orange, CFrame.new(0, 1.0, 3.5 + i * 0.5) * ALONG_Z, { cyl = true })
	end
	newPart(m, at, "Mattress", Vector3.new(3.8, 0.6, 6.4), Color3.fromRGB(250, 250, 255), CFrame.new(0, 2.1, 0), { material = Enum.Material.Fabric })
	newPart(m, at, "Blanket", Vector3.new(3.9, 0.3, 3.6), C.Blue, CFrame.new(0, 2.45, -1.3), { material = Enum.Material.Fabric })
	newPart(m, at, "Pillow", Vector3.new(2.6, 0.7, 1.4), Color3.fromRGB(255, 240, 220), CFrame.new(0, 2.6, 2.4), { sphere = true, material = Enum.Material.Fabric })
	for _, side in ipairs({ -1, 1 }) do
		newPart(m, at, "BedFin", Vector3.new(0.4, 2.2, 1.8), C.Orange, CFrame.new(side * 2.3, 1.4, -3.2), { class = "WedgePart" })
	end
	local seat = newPart(m, at, "Seat", Vector3.new(2.4, 0.4, 2.4), C.Trim, CFrame.new(0, 2.5, 0.4), { class = "Seat", transparency = 1 })
	seat.Disabled = display
	return seat
end

function BUILD.disco(m, at, display)
	-- hangs from the base roof; on a shop stand it sits on a short pole
	local ballY = display and 3.4 or 10
	local top = display and 1.2 or 15.1
	newPart(m, at, "Chain", Vector3.new(top - ballY, 0.18, 0.18), Color3.fromRGB(180, 186, 200), CFrame.new(0, (top + ballY) / 2, 0) * UP, { cyl = true, collide = false })
	local ball = newPart(m, at, "DiscoBall", Vector3.new(2.6, 2.6, 2.6), Color3.fromRGB(225, 230, 245), CFrame.new(0, ballY, 0), { ball = true, material = Enum.Material.Foil, collide = false })
	ball:SetAttribute("Disco", true)
	for i, col in ipairs({ Color3.fromRGB(255, 90, 160), Color3.fromRGB(90, 200, 255), Color3.fromRGB(255, 220, 90), Color3.fromRGB(140, 255, 140) }) do
		local l = Instance.new("SpotLight")
		l.Name = "DiscoLight" .. i
		l.Color = col
		l.Range = 30
		l.Angle = 40
		l.Brightness = 0 -- switched on by Station.client.lua while the base's party is on
		l.Face = ({ Enum.NormalId.Front, Enum.NormalId.Back, Enum.NormalId.Left, Enum.NormalId.Right })[i]
		l.Parent = ball
	end
	return ball
end

function BUILD.trampoline(m, at, display)
	local mat = newPart(m, at, "TrampolineMat", Vector3.new(0.3, 6.4, 6.4), Color3.fromRGB(30, 34, 48), CFrame.new(0, 1.7, 0) * UP, { cyl = true })
	newPart(m, at, "TrampolineRim", Vector3.new(0.5, 7.2, 7.2), C.Blue, CFrame.new(0, 1.6, 0) * UP, { cyl = true, material = Enum.Material.Neon })
	for i = 0, 3 do
		local a = math.rad(45 + i * 90)
		newPart(m, at, "TrampolineLeg", Vector3.new(0.4, 1.6, 0.4), Color3.fromRGB(120, 128, 150), CFrame.new(math.cos(a) * 3, 0.8, math.sin(a) * 3))
	end
	if not display then
		mat:SetAttribute("Bounce", 95) -- Station.client.lua launches whoever lands on it
	end
	return mat
end

function BUILD.telescope(m, at, display)
	for i = 0, 2 do
		local a = math.rad(i * 120)
		newPart(m, at, "TripodLeg", Vector3.new(0.25, 3.4, 0.25), Color3.fromRGB(70, 76, 96), CFrame.new(math.cos(a) * 0.9, 1.6, math.sin(a) * 0.9) * CFrame.Angles(math.sin(a) * 0.3, 0, -math.cos(a) * 0.3))
	end
	local tube = newPart(m, at, "TelescopeTube", Vector3.new(4.2, 0.9, 0.9), C.Trim, CFrame.new(0, 3.6, -0.6) * CFrame.Angles(math.rad(35), 0, 0) * ALONG_Z, { cyl = true })
	newPart(m, at, "TubeBand", Vector3.new(0.3, 1.0, 1.0), C.Orange, CFrame.new(0, 3.6, -0.6) * CFrame.Angles(math.rad(35), 0, 0) * ALONG_Z * CFrame.new(1.2, 0, 0), { cyl = true })
	newPart(m, at, "Lens", Vector3.new(0.12, 0.8, 0.8), C.Blue, CFrame.new(0, 3.6, -0.6) * CFrame.Angles(math.rad(35), 0, 0) * CFrame.new(0, 0, -2.12) * ALONG_Z, { cyl = true, material = Enum.Material.Neon })
	return tube
end

function BUILD.arcade(m, at, display)
	local cab = newPart(m, at, "Cabinet", Vector3.new(3, 6, 2.6), Color3.fromRGB(110, 70, 200), CFrame.new(0, 3, 0))
	newPart(m, at, "Screen", Vector3.new(2.4, 1.8, 0.2), Color3.fromRGB(80, 220, 255), CFrame.new(0, 4.3, -1.25) * CFrame.Angles(math.rad(-12), 0, 0), { material = Enum.Material.Neon })
	newPart(m, at, "Marquee", Vector3.new(3, 0.9, 0.3), C.Orange, CFrame.new(0, 5.6, -1.2), { material = Enum.Material.Neon })
	newPart(m, at, "Panel", Vector3.new(3, 0.3, 1.2), Color3.fromRGB(40, 44, 62), CFrame.new(0, 3.1, -1.6) * CFrame.Angles(math.rad(-15), 0, 0))
	newPart(m, at, "Stick", Vector3.new(0.4, 0.4, 0.4), Color3.fromRGB(255, 70, 70), CFrame.new(-0.6, 3.6, -1.6), { ball = true })
	for i, col in ipairs({ Color3.fromRGB(255, 220, 60), Color3.fromRGB(90, 255, 120) }) do
		newPart(m, at, "Button", Vector3.new(0.15, 0.35, 0.35), col, CFrame.new(0.3 + i * 0.45, 3.35, -1.65) * UP, { cyl = true, material = Enum.Material.Neon })
	end
	return cab
end

-- builds one piece; returns the model and the part a prompt or seat belongs to
function Furniture.build(id, at, parent, display)
	local m = Instance.new("Model")
	m.Name = (Config.furnitureById(id) or {}).name or id
	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = Vector3.new(0.2, 0.2, 0.2)
	root.Transparency = 1
	root.Anchored = true
	root.CanCollide = false
	root.CanQuery = false
	root.CFrame = at
	root.Parent = m
	m.PrimaryPart = root
	local key = BUILD[id] and BUILD[id](m, at, display) or nil
	m.Parent = parent
	return m, key
end

return Furniture
