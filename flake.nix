{
  description = "Amaryllis development and CI toolchain";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_22;
          ciToolchain = pkgs.symlinkJoin {
            name = "amaryllis-ci-toolchain";
            paths = [
              nodejs
              pkgs.yarn
              pkgs.git
              pkgs.gnumake
              pkgs.pkg-config
              pkgs.python3
            ];
          };
        in
        {
          ci-toolchain = ciToolchain;
          default = ciToolchain;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = [ self.packages.${system}.ci-toolchain ];
          };
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_22;
        in
        {
          toolchain = pkgs.runCommand "amaryllis-toolchain-check" {
            nativeBuildInputs = [ self.packages.${system}.ci-toolchain ];
          } ''
            test "${nodejs.version}" = "$(node --version | sed 's/^v//')"
            test -f ${./.yarn/releases/yarn-3.6.1.cjs}
            test "$(yarn --version)" = "3.6.1"
            touch "$out"
          '';
        }
      );
    };
}
