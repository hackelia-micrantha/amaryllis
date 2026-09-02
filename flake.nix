{
  description = "Amaryllis development and CI toolchain";

  inputs.nixpkgs.url = "https://channels.nixos.org/nixos-26.05/nixexprs.tar.xz";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          yarn = pkgs.writeShellScriptBin "yarn" ''
            exec ${pkgs.corepack}/bin/corepack yarn "$@"
          '';
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_24
              pkgs.corepack
              yarn
            ];
          };
        });
    };
}
