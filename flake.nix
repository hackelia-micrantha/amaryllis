{
  description = "Amaryllis development and CI toolchains";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/2c423e03bbafcff28bfadc6781a4a8257f205cb5";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f:
        nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
      mkYarn = pkgs:
        pkgs.writeShellScriptBin "yarn" ''
          exec ${pkgs.corepack}/bin/corepack yarn "$@"
        '';
      mkNodeShell = pkgs: node:
        pkgs.mkShellNoCC {
          packages = [
            node
            pkgs.corepack
            (mkYarn pkgs)
          ];
        };
    in
    {
      devShells = forAllSystems (pkgs: {
        default = mkNodeShell pkgs pkgs.nodejs_24;
        ci = mkNodeShell pkgs pkgs.nodejs_24;
        node20 = mkNodeShell pkgs pkgs.nodejs_20;
        node22 = mkNodeShell pkgs pkgs.nodejs_22;
        node24 = mkNodeShell pkgs pkgs.nodejs_24;
      });
    };
}
