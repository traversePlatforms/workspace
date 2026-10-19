-- Gear on this player's screen (2026-10-18): the Jet Boots' mid-air rocket boost for you, jet flames under everyone
-- wearing them, and the Gear Bay prompts saying "Take" instead of "Buy" for gear you already own.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ProximityPromptService = game:GetService("ProximityPromptService")
local SoundService = game:GetService("SoundService")

local Config = require(ReplicatedStorage.Shared.Config)
local player = Players.LocalPlayer
local C = Config.Colors

-- ---------- your boost: press jump again while in the air, once per jump ----------
local boosted, jumpedAt = false, 0
local function hookCharacter(ch)
	local hum = ch:WaitForChild("Humanoid", 10)
	if not hum then
		return
	end
	boosted = false
	hum.StateChanged:Connect(function(_, new)
		if new == Enum.HumanoidStateType.Jumping then
			jumpedAt = os.clock()
		elseif new == Enum.HumanoidStateType.Landed or new == Enum.HumanoidStateType.Running then
			boosted = false
		end
	end)
end
player.CharacterAdded:Connect(hookCharacter)
if player.Character then
	task.spawn(hookCharacter, player.Character)
end

UserInputService.JumpRequest:Connect(function()
	local ch = player.Character
	-- Jet Boots give a rocket boost; Double Jump (an upgrade) a plain second jump (2026-10-18)
	local power = ch and (ch:GetAttribute("JetBoots") or (ch:GetAttribute("DoubleJump") and 52))
	local hum = ch and ch:FindFirstChildOfClass("Humanoid")
	local hrp = ch and ch:FindFirstChild("HumanoidRootPart")
	if not (power and hum and hrp) or boosted then
		return
	end
	if hum:GetState() ~= Enum.HumanoidStateType.Freefall or os.clock() - jumpedAt < 0.2 then
		return
	end
	boosted = true
	local v = hrp.AssemblyLinearVelocity
	hrp.AssemblyLinearVelocity = Vector3.new(v.X * 1.2, power, v.Z * 1.2)
	ch:SetAttribute("BoostedAt", os.clock()) -- only this screen reads it; others see the flames from the speed
	local def = ch:GetAttribute("JetBoots") and Config.Sounds.boost or Config.Sounds.swing
	if def then
		local s = Instance.new("Sound")
		s.SoundId = "rbxassetid://" .. def.id
		s.Volume = def.volume or 0.5
		s.Parent = SoundService
		s:Play()
		task.delay(def.stopAfter or 1, function()
			s:Destroy()
		end)
	end
end)

-- ---------- jet flames under anyone wearing Jet Boots, while they're rising ----------
local flames = {} -- [nozzle part] = ParticleEmitter
local function flameFor(nozzle)
	local e = flames[nozzle]
	if e and e.Parent then
		return e
	end
	e = Instance.new("ParticleEmitter")
	e.Color = ColorSequence.new(Color3.fromRGB(255, 240, 170), C.Orange)
	e.LightEmission = 1
	e.Size = NumberSequence.new(0.7, 0)
	e.Lifetime = NumberRange.new(0.15, 0.3)
	e.Rate = 60
	e.Speed = NumberRange.new(6, 10)
	e.EmissionDirection = Enum.NormalId.Bottom
	e.Enabled = false
	e.Parent = nozzle
	flames[nozzle] = e
	return e
end

RunService.RenderStepped:Connect(function()
	for _, p in ipairs(Players:GetPlayers()) do
		local ch = p.Character
		local boots = ch and ch:GetAttribute("JetBoots") and ch:FindFirstChild("JetBoots")
		local hrp = ch and ch:FindFirstChild("HumanoidRootPart")
		if boots and hrp then
			local rising = hrp.AssemblyLinearVelocity.Y > 6
			for _, part in ipairs(boots:GetChildren()) do
				if part:GetAttribute("JetNozzle") then
					flameFor(part).Enabled = rising
				end
			end
		end
	end
end)

-- ---------- Gear Bay prompts: "Take" for gear you own ----------
ProximityPromptService.PromptShown:Connect(function(prompt)
	-- the Upgrade Lab: your next level and its price, or MAXED
	local uid = prompt:GetAttribute("UpgradeId")
	local u = uid and Config.upgradeById(uid)
	if u then
		local lv = player:GetAttribute("Up_" .. uid) or 0
		if lv >= #u.prices then
			prompt.ActionText = "MAXED"
		else
			local n = tostring(u.prices[lv + 1]):reverse():gsub("(%d%d%d)", "%1,"):reverse():gsub("^,", "")
			prompt.ActionText = (#u.prices > 1 and ("Level " .. (lv + 1) .. " ") or "Buy ") .. "(" .. n .. " ★)"
		end
	end
	local fid = prompt:GetAttribute("FurnitureId")
	if fid and player:GetAttribute("OwnsF_" .. fid) then
		prompt.ActionText = "In your base"
	end
	local id = prompt:GetAttribute("GearId")
	local def = id and Config.gearById(id)
	if def and player:GetAttribute("Owns_" .. id) then
		prompt.ActionText = def.kind == "weapon" and "In your backpack" or "Owned"
	end
end)
