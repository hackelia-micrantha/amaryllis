{
  description = "Amaryllis development and CI toolchains";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/2c423e03bbafcff28bfadc6781a4a8257f205cb5";
    nixpkgs-node20.url = "github:NixOS/nixpkgs/ac62194c3917d5f474c1a844b6fd6da2db95077d";
  };

  outputs = { nixpkgs, nixpkgs-node20, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f:
        nixpkgs.lib.genAttrs systems (
          system:
          f
            (import nixpkgs { inherit system; })
            (import nixpkgs-node20 { inherit system; })
        );
      mkYarn = pkgs:
        pkgs.writeShellScriptBin "yarn" ''
          exec ${pkgs.corepack}/bin/corepack yarn "$@"
        '';
      mkNodeShell = pkgs: node: extraPackages:
        pkgs.mkShellNoCC {
          packages = [
            node
            pkgs.corepack
            (mkYarn pkgs)
          ] ++ extraPackages;
        };
    in
    {
      devShells = forAllSystems (pkgs: legacyPkgs: {
        default = mkNodeShell pkgs pkgs.nodejs_24 [ ];
        ci = mkNodeShell pkgs pkgs.nodejs_24 [ pkgs.actionlint ];
        node20 = mkNodeShell legacyPkgs legacyPkgs.nodejs_20 [ ];
        node22 = mkNodeShell pkgs pkgs.nodejs_22 [ ];
        node24 = mkNodeShell pkgs pkgs.nodejs_24 [ ];
      });
    };
}
