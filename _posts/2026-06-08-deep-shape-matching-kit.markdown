---
layout: post
title:  "DeepShapeMatchingKit: Accelerated Functional Map Solver and Shape Matching Pipelines Revisited"
date:   2026-06-08
image: /images/deep-shape-matching-kit.png
categories: workshop
author: "Lennart Bastian"
authors: "Yizheng Xie, <strong>Lennart Bastian</strong>, Congyue Deng, Thomas W. Mitchel, Maolin Gao, Daniel Cremers"
venue: "CVPR Image Matching Workshop (<strong>IMW</strong>) 2026"
venue_short: "CVPRW"
eprint: https://arxiv.org/abs/2604.10377
code: https://github.com/xieyizheng/DeepShapeMatchingKit
---

Deep functional maps underpin non-rigid 3D shape matching but rely on solvers that process spectral systems serially, a bottleneck at higher resolution. We introduce a vectorized reformulation that solves them in a single kernel call for up to a 33x speedup with identical results, document a previously unnoticed divergence in DiffusionNet's spatial-gradient features, and revisit overlap metrics for partial-to-partial matching. These improvements ship in DeepShapeMatchingKit, an open-source toolkit that standardizes training, evaluation, and data pipelines for common deep shape matching methods.
