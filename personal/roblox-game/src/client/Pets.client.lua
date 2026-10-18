-- Draws every player's pet (the critter they picked in the Collection Book) floating along beside them.
-- Purely on each screen: it costs the server nothing and never affects the game.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Config = require(ReplicatedStorage.Shared.Config)
local CritterModels = require(ReplicatedStorage.Shared.CritterModels)

local folder = Instance.new("Folder")
folder.Name = "Pets"
folder.Parent = workspace

local pets = {} -- [player] = { key, model, phase }

local function buildPet(key, owner)
	local def, mut = Config.fromKey(key)
	if not def then
		return nil
	end
	local m = CritterModels.build(def, CFrame.new(0, -500, 0), mut)
	local body = m.PrimaryPart
	local tag = body:FindFirstChild("Tag")
	if tag then
		local nameL = tag:FindFirstChild("CritterName")
		local info = tag:FindFirstChild("Info")
		if info then
			info.Text = owner.DisplayName .. "'s pet"
		end
		if nameL then
			nameL.Text = m.Name
		end
		tag.MaxDistance = 40
		tag.StudsOffsetWorldSpace = Vector3.new(0, 3, 0)
	end
	pcall(function()
		m:ScaleTo(0.6)
	end)
	m.Parent = folder
	return m
end

local keep = { Eye = true, Pupil = true, Nose = true }
local t = 0
RunService.RenderStepped:Connect(function(dt)
	t += dt
	for _, p in ipairs(Players:GetPlayers()) do
		local key = p:GetAttribute("Pet")
		local rec = pets[p]
		if (rec and rec.key) ~= key then
			if rec and rec.model then
				rec.model:Destroy()
			end
			pets[p] = nil
			rec = nil
			if key then
				rec = { key = key, model = buildPet(key, p), phase = math.random() * 6 }
				pets[p] = rec
			end
		end
		local hrp = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		if rec and rec.model and hrp then
			local target = hrp.CFrame * CFrame.new(3.4, 1.4 + math.sin(t * 3 + rec.phase) * 0.45, 3)
			local current = rec.model:GetPivot()
			if (current.Position - target.Position).Magnitude > 40 then
				rec.model:PivotTo(target) -- teleported: catch up at once
			else
				rec.model:PivotTo(current:Lerp(target, math.clamp(dt * 7, 0, 1)))
			end
			if rec.model:GetAttribute("Rainbow") then
				local h = (t * 0.25) % 1
				for _, part in ipairs(rec.model:GetDescendants()) do
					if part:IsA("BasePart") and not keep[part.Name] then
						part.Color = Color3.fromHSV(h, 0.55, 1)
					end
				end
			end
		end
	end
	for p, rec in pairs(pets) do
		if not p.Parent then
			if rec.model then
				rec.model:Destroy()
			end
			pets[p] = nil
		end
	end
end)
